import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { hasBell } from './scheduleUtils';

const TEN_MIN_IN_HOURS = 1 / 6;

// 안드로이드 13+에서 POST_NOTIFICATIONS는 Push/Local 알림이 공유하는 런타임 권한이라,
// 둘이 거의 동시에 요청하면 시스템 권한 다이얼로그가 겹쳐 WebView 입력이 먹통이 될 수 있음.
// 진행 중인 요청 Promise를 모듈 스코프에 하나만 두고 Push/Local 양쪽이 공유해서 한 번만 뜨게 함.
// 이 게이트는 "앱 시작 시 자동으로 뜨는" 요청 전용 — 배너 "켜기" 등 사용자가 직접 누른 재요청은
// 이 함수를 거치지 않고 LocalNotifications.requestPermissions()를 직접 호출하므로 이 제한을 받지 않음.
let notifPermissionPromise = null;
// 요청을 한 번이라도 시도했으면 true — 시간차 호출이 checkPermissions()에서 여전히 'prompt'를
// 보더라도(다이얼로그가 사라졌다가 재확인되는 경우 등) 같은 앱 실행 중엔 다시 요청하지 않기 위한 기억값
let hasRequestedNotifPermission = false;
// 앱을 껐다 켜도 자동 요청은 최초 1회만 — 실제로 요청을 수행한 직후(결과와 무관하게) 저장
const NOTIF_ASKED_KEY = 'chodinglife_notifAsked';

export function requestNotificationPermissionOnce() {
  if (notifPermissionPromise) return notifPermissionPromise;

  notifPermissionPromise = (async () => {
    try {
      const status = await LocalNotifications.checkPermissions();
      const alreadyAskedBefore = !!localStorage.getItem(NOTIF_ASKED_KEY);
      if (!alreadyAskedBefore && !hasRequestedNotifPermission && (status.display === 'prompt' || status.display === 'prompt-with-rationale')) {
        hasRequestedNotifPermission = true;
        try {
          return await LocalNotifications.requestPermissions();
        } finally {
          localStorage.setItem(NOTIF_ASKED_KEY, '1');
        }
      }
      return status;
    } finally {
      notifPermissionPromise = null;
    }
  })();

  return notifPermissionPromise;
}

// 스케줄의 요일 인덱스 계산: HomePage.jsx의 curD 공식과 동일 (0=월 ~ 6=일)
function dayIndexOf(date) {
  const d = date.getDay();
  return d === 0 ? 6 : d - 1;
}

// baseDate의 달력 날짜 + hourFloat(시간 단위 소수)을 합쳐 정확한 Date를 만듦
// setHours 대신 자정 기준 ms 덧셈을 사용 — hourFloat이 음수/24 초과여도 날짜가 자연스럽게 넘어감
function dateAtHour(baseDate, hourFloat) {
  const midnight = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate(), 0, 0, 0, 0);
  midnight.setTime(midnight.getTime() + Math.round(hourFloat * 60 * 60 * 1000));
  return midnight;
}

// 날짜 + 항목 인덱스로 충돌 없는 32비트 정수 id 생성 (예: 2026-07-14, idx 5 → 2026071405)
function notifyIdFor(date, idx) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const i = String(idx).padStart(2, '0');
  return parseInt(`${y}${m}${d}${i}`, 10);
}

async function cancelAllPending() {
  const pending = await LocalNotifications.getPending();
  if (pending.notifications.length > 0) {
    await LocalNotifications.cancel({
      notifications: pending.notifications.map(n => ({ id: n.id })),
    });
  }
}

// 예약된 학원 알림을 전부 취소 (부모모드 전환 시 등 사용)
export async function cancelClassReminders() {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await cancelAllPending();
  } catch (e) {
    console.warn('[localNotify] 예약 취소 실패:', e.message);
  }
}

// 오늘 포함 3일치 스케줄을 훑어서 각 항목 시작 10분 전 알림을 예약
// SCH: AppContext의 SCH 객체 그대로 (요일 인덱스 0~6 → 항목 배열, 항목.start는 시간 단위 float)
export async function scheduleClassReminders(SCH) {
  if (!Capacitor.isNativePlatform()) return;
  if (!SCH) return;

  try {
    await cancelAllPending();
  } catch (e) {
    console.warn('[localNotify] 기존 예약 취소 실패:', e.message);
  }

  try {
    const permRes = await requestNotificationPermissionOnce();
    if (permRes.display !== 'granted') {
      console.warn('[localNotify] 알림 권한이 거부됐어요');
      return;
    }
  } catch (e) {
    console.warn('[localNotify] 권한 요청 실패:', e.message);
    return;
  }

  const now = new Date();
  const notifications = [];

  for (let offset = 0; offset < 3; offset++) {
    const dayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
    const dayIdx = dayIndexOf(dayDate);
    const items = SCH[dayIdx] || [];

    items.forEach((item, idx) => {
      if (typeof item.start !== 'number') return;
      if (!hasBell(item)) return; // 종이 꺼진 항목은 예약하지 않음
      const notifyAt = dateAtHour(dayDate, item.start - TEN_MIN_IN_HOURS);
      if (notifyAt <= now) return; // 이미 지난 시각이면 건너뜀

      notifications.push({
        id: notifyIdFor(dayDate, idx),
        title: `⏰ 곧 ${item.name} 시간이에요!`,
        body: '도착하면 도착체크 눌러주세요 📍',
        schedule: { at: notifyAt, allowWhileIdle: true },
        extra: { goto: 'arrive' },
      });
    });
  }

  if (notifications.length === 0) return;

  try {
    await LocalNotifications.schedule({ notifications });
    console.log(`[localNotify] ${notifications.length}건 예약 완료`);
  } catch (e) {
    console.warn('[localNotify] 예약 실패:', e.message);
  }
}
