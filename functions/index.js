const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onDocumentWritten } = require("firebase-functions/v2/firestore");
const { defineSecret } = require("firebase-functions/params");
const axios = require("axios");
const admin = require("firebase-admin");

if (!admin.apps.length) {
  admin.initializeApp();
}

const papagoClientId     = defineSecret("PAPAGO_CLIENT_ID");
const papagoClientSecret = defineSecret("PAPAGO_CLIENT_SECRET");

exports.translateWord = onCall(
  { enforceAppCheck: false, secrets: [papagoClientId, papagoClientSecret] },
  async (request) => {
    const { text } = request.data;

    if (!text) {
      throw new HttpsError("invalid-argument", "번역할 단어가 없습니다.");
    }

    try {
      console.log("[translateWord] 번역 요청:", text);
      const response = await axios.post(
        "https://papago.apigw.ntruss.com/nmt/v1/translation",
        `source=en&target=ko&text=${encodeURIComponent(text)}`,
        {
          headers: {
            "X-NCP-APIGW-API-KEY-ID": papagoClientId.value(),
            "X-NCP-APIGW-API-KEY":    papagoClientSecret.value(),
            "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8"
          }
        }
      );
      console.log("[translateWord] Papago 응답:", JSON.stringify(response.data));
      return { translated: response.data.message.result.translatedText };
    } catch (error) {
      console.error("[translateWord] 오류:", error.message);
      if (error.response) {
        console.error("[translateWord] Papago HTTP 상태:", error.response.status);
        console.error("[translateWord] Papago 응답 바디:", JSON.stringify(error.response.data));
      }
      throw new HttpsError("internal", "번역 실패: " + error.message);
    }
  }
);

// 도착체크 시 부모 기기로 FCM 알림 발송
// arriveData 구조: { [날짜(YYYY-MM-DD)]: { "${curD}_${idx}_${itemName}": true, ... } }
exports.onArriveNotify = onDocumentWritten(
  { document: "families/{familyCode}/data/arrive", region: "us-central1" },
  async (event) => {
    const { familyCode } = event.params;
    const afterSnap = event.data.after;
    if (!afterSnap || !afterSnap.exists) return; // 문서 삭제된 경우 알림 없음

    const beforeSnap = event.data.before;
    let beforeArrive = {};
    let afterArrive = {};
    try {
      const beforeRaw = beforeSnap && beforeSnap.exists ? beforeSnap.data().arriveData : null;
      beforeArrive = beforeRaw ? JSON.parse(beforeRaw) : {};
    } catch (e) {
      beforeArrive = {};
    }
    try {
      const afterRaw = afterSnap.data().arriveData;
      afterArrive = afterRaw ? JSON.parse(afterRaw) : {};
    } catch (e) {
      afterArrive = {};
    }

    // 변경 전후 비교로 새로 추가된 도착만 감지 (기존 도착엔 알림 재발사 안 함)
    const newArrivals = [];
    for (const dateKey of Object.keys(afterArrive)) {
      const afterDay = afterArrive[dateKey] || {};
      const beforeDay = beforeArrive[dateKey] || {};
      for (const key of Object.keys(afterDay)) {
        if (!beforeDay[key]) {
          const itemName = key.split("_").slice(2).join("_") || "어딘가";
          newArrivals.push(itemName);
        }
      }
    }

    if (newArrivals.length === 0) {
      console.log(`[onArriveNotify] ${familyCode}: 새로 추가된 도착 없음`);
      return;
    }

    const tokensRef = admin.firestore().doc(`families/${familyCode}/data/fcm_tokens`);
    const tokensSnap = await tokensRef.get();
    if (!tokensSnap.exists) {
      console.log(`[onArriveNotify] ${familyCode}: fcm_tokens 문서 없음`);
      return;
    }
    const tokensData = tokensSnap.data().tokens || {};
    const parentTokens = Object.keys(tokensData).filter(
      (t) => tokensData[t] && tokensData[t].role === "parent"
    );

    if (parentTokens.length === 0) {
      console.log(`[onArriveNotify] ${familyCode}: 부모 토큰 없음`);
      return;
    }

    const place = newArrivals[0];
    const title = "도착 알림 📍";
    const body = `${place}에 도착했어요!`;

    const invalidTokens = [];
    await Promise.all(
      parentTokens.map(async (token) => {
        try {
          await admin.messaging().send({ token, notification: { title, body }, data: { goto: "parent_status" } });
        } catch (e) {
          console.error(`[onArriveNotify] 발송 실패 (${token.slice(0, 12)}...):`, e.code || e.message);
          if (
            e.code === "messaging/registration-token-not-registered" ||
            e.code === "messaging/invalid-registration-token"
          ) {
            invalidTokens.push(token);
          }
        }
      })
    );

    if (invalidTokens.length > 0) {
      const args = [];
      invalidTokens.forEach((t) => {
        args.push(new admin.firestore.FieldPath("tokens", t), admin.firestore.FieldValue.delete());
      });
      await tokensRef.update(...args);
      console.log(`[onArriveNotify] 만료 토큰 ${invalidTokens.length}개 정리 완료`);
    }

    console.log(
      `[onArriveNotify] ${familyCode}: "${place}" 알림 ${parentTokens.length - invalidTokens.length}건 발송 완료`
    );
  }
);

// ── 아래 5개 함수 공통: fcm_tokens에서 role 토큰 수집 → 발송 → 만료 토큰 정리
// (onArriveNotify와 동일한 로직을 헬퍼로 추출한 것일 뿐, onArriveNotify 자체는 건드리지 않음)
async function sendToTokens(familyCode, roleFilter, title, body, logPrefix, goto) {
  const tokensRef = admin.firestore().doc(`families/${familyCode}/data/fcm_tokens`);
  const tokensSnap = await tokensRef.get();
  if (!tokensSnap.exists) {
    console.log(`[${logPrefix}] ${familyCode}: fcm_tokens 문서 없음`);
    return;
  }
  const tokensData = tokensSnap.data().tokens || {};
  const targetTokens = Object.keys(tokensData).filter(
    (t) => tokensData[t] && tokensData[t].role === roleFilter
  );

  if (targetTokens.length === 0) {
    console.log(`[${logPrefix}] ${familyCode}: ${roleFilter} 토큰 없음`);
    return;
  }

  const invalidTokens = [];
  await Promise.all(
    targetTokens.map(async (token) => {
      try {
        await admin.messaging().send({ token, notification: { title, body }, data: { goto } });
      } catch (e) {
        console.error(`[${logPrefix}] 발송 실패 (${token.slice(0, 12)}...):`, e.code || e.message);
        if (
          e.code === "messaging/registration-token-not-registered" ||
          e.code === "messaging/invalid-registration-token"
        ) {
          invalidTokens.push(token);
        }
      }
    })
  );

  if (invalidTokens.length > 0) {
    const args = [];
    invalidTokens.forEach((t) => {
      args.push(new admin.firestore.FieldPath("tokens", t), admin.firestore.FieldValue.delete());
    });
    await tokensRef.update(...args);
    console.log(`[${logPrefix}] 만료 토큰 ${invalidTokens.length}개 정리 완료`);
  }

  console.log(
    `[${logPrefix}] ${familyCode}: 알림 ${targetTokens.length - invalidTokens.length}건 발송 완료`
  );
}

// 부모가 응원메시지를 보내면 아이에게 알림 (message 문서, 내용이 실제로 바뀐 경우만)
exports.onMessageNotify = onDocumentWritten(
  { document: "families/{familyCode}/data/message", region: "us-central1" },
  async (event) => {
    const { familyCode } = event.params;
    const afterSnap = event.data.after;
    if (!afterSnap || !afterSnap.exists) return; // 삭제된 경우 알림 없음

    const beforeSnap = event.data.before;
    const afterData = afterSnap.data() || {};
    const beforeData = beforeSnap && beforeSnap.exists ? beforeSnap.data() : null;

    if (!afterData.text) return;
    if (beforeData && beforeData.text === afterData.text) {
      console.log(`[onMessageNotify] ${familyCode}: 동일한 메시지, 알림 생략`);
      return;
    }

    await sendToTokens(
      familyCode,
      "child",
      "응원 메시지 💌",
      "엄마아빠의 응원이 도착했어요!",
      "onMessageNotify",
      "home"
    );
  }
);

// 아이가 숙제를 제출(status→pending)하면 부모에게 알림 (homework 문서)
// hwData 구조: { [key]: { [ds]: { status: 'none'|'pending'|'done', ... } } }
exports.onHwCheckNotify = onDocumentWritten(
  { document: "families/{familyCode}/data/homework", region: "us-central1" },
  async (event) => {
    const { familyCode } = event.params;
    const afterSnap = event.data.after;
    if (!afterSnap || !afterSnap.exists) return;

    const beforeSnap = event.data.before;
    let beforeHw = {};
    let afterHw = {};
    try {
      const beforeRaw = beforeSnap && beforeSnap.exists ? beforeSnap.data().hwData : null;
      beforeHw = beforeRaw ? JSON.parse(beforeRaw) : {};
    } catch (e) {
      beforeHw = {};
    }
    try {
      const afterRaw = afterSnap.data().hwData;
      afterHw = afterRaw ? JSON.parse(afterRaw) : {};
    } catch (e) {
      afterHw = {};
    }

    // 새로 'pending'(제출)으로 바뀐 항목만 감지 — 승인/취소(done/none)는 무시
    let submitted = false;
    for (const key of Object.keys(afterHw)) {
      const afterDay = afterHw[key] || {};
      const beforeDay = beforeHw[key] || {};
      for (const ds of Object.keys(afterDay)) {
        const afterStatus = afterDay[ds] && afterDay[ds].status;
        const beforeStatus = beforeDay[ds] && beforeDay[ds].status;
        if (afterStatus === "pending" && beforeStatus !== "pending") {
          submitted = true;
        }
      }
    }

    if (!submitted) {
      console.log(`[onHwCheckNotify] ${familyCode}: 새로운 제출 없음`);
      return;
    }

    await sendToTokens(
      familyCode,
      "parent",
      "숙제 제출 ✏️",
      "숙제를 완료했어요! 확인해주세요",
      "onHwCheckNotify",
      "parent_homework"
    );
  }
);

// 숙제 사진이 새로 추가되면 부모에게 알림 (hw_photo_urls 문서, urls는 일반 map 필드)
// 주간 리셋은 urls를 {}로 비우기만 하므로 '새 키 추가' 여부만 보면 자동으로 무시됨
exports.onHwPhotoNotify = onDocumentWritten(
  { document: "families/{familyCode}/data/hw_photo_urls", region: "us-central1" },
  async (event) => {
    const { familyCode } = event.params;
    const afterSnap = event.data.after;
    if (!afterSnap || !afterSnap.exists) return;

    const beforeSnap = event.data.before;
    const beforeUrls = (beforeSnap && beforeSnap.exists && beforeSnap.data().urls) || {};
    const afterUrls = afterSnap.data().urls || {};

    const hasNewPhoto = Object.keys(afterUrls).some((k) => !beforeUrls[k]);
    if (!hasNewPhoto) {
      console.log(`[onHwPhotoNotify] ${familyCode}: 새로 추가된 사진 없음`);
      return;
    }

    await sendToTokens(
      familyCode,
      "parent",
      "숙제 사진 📷",
      "숙제 사진을 올렸어요!",
      "onHwPhotoNotify",
      "parent_homework"
    );
  }
);

// 부모가 숙제를 승인(hwlog에 새 항목)하면 아이에게 알림 (hwlog 문서)
exports.onHwApproveNotify = onDocumentWritten(
  { document: "families/{familyCode}/data/hwlog", region: "us-central1" },
  async (event) => {
    const { familyCode } = event.params;
    const afterSnap = event.data.after;
    if (!afterSnap || !afterSnap.exists) return;

    const beforeSnap = event.data.before;
    let beforeLog = {};
    let afterLog = {};
    try {
      const beforeRaw = beforeSnap && beforeSnap.exists ? beforeSnap.data().hwLog : null;
      beforeLog = beforeRaw ? JSON.parse(beforeRaw) : {};
    } catch (e) {
      beforeLog = {};
    }
    try {
      const afterRaw = afterSnap.data().hwLog;
      afterLog = afterRaw ? JSON.parse(afterRaw) : {};
    } catch (e) {
      afterLog = {};
    }

    // 새로 추가된 승인 항목만 감지 (취소=키 삭제, 주간 리셋=전체 비움은 무시됨)
    const hasNewApproval = Object.keys(afterLog).some((k) => !beforeLog[k]);
    if (!hasNewApproval) {
      console.log(`[onHwApproveNotify] ${familyCode}: 새로운 승인 없음`);
      return;
    }

    await sendToTokens(
      familyCode,
      "child",
      "숙제 승인 ⭐",
      "숙제 +20점! 참 잘했어요",
      "onHwApproveNotify",
      "homework"
    );
  }
);

// 부모가 보너스를 지급(bonuslog에 새 항목)하면 아이에게 알림 (bonuslog 문서)
exports.onBonusNotify = onDocumentWritten(
  { document: "families/{familyCode}/data/bonuslog", region: "us-central1" },
  async (event) => {
    const { familyCode } = event.params;
    const afterSnap = event.data.after;
    if (!afterSnap || !afterSnap.exists) return;

    const beforeSnap = event.data.before;
    let beforeLog = {};
    let afterLog = {};
    try {
      const beforeRaw = beforeSnap && beforeSnap.exists ? beforeSnap.data().bonusLog : null;
      beforeLog = beforeRaw ? JSON.parse(beforeRaw) : {};
    } catch (e) {
      beforeLog = {};
    }
    try {
      const afterRaw = afterSnap.data().bonusLog;
      afterLog = afterRaw ? JSON.parse(afterRaw) : {};
    } catch (e) {
      afterLog = {};
    }

    // 새로 추가된 보너스 항목만 감지 (주간 정리로 지난주 항목이 삭제되는 건 무시됨)
    const newKeys = Object.keys(afterLog).filter((k) => !beforeLog[k]);
    if (newKeys.length === 0) {
      console.log(`[onBonusNotify] ${familyCode}: 새로운 보너스 없음`);
      return;
    }

    // bonusLog 키는 Date.now() 문자열이라 숫자형 키 → JS가 자동으로 오름차순 정렬해줌
    const latestEntry = afterLog[newKeys[newKeys.length - 1]] || {};
    const pts = latestEntry.pts || 0;

    await sendToTokens(
      familyCode,
      "child",
      "보너스 포인트 🌟",
      `보너스 +${pts}점을 받았어요!`,
      "onBonusNotify",
      "points"
    );
  }
);

// 아이가 목표 달성 후 보상을 선택(rewardlog에 새 항목)하면 부모에게 알림 (rewardlog 문서)
exports.onRewardNotify = onDocumentWritten(
  { document: "families/{familyCode}/data/rewardlog", region: "us-central1" },
  async (event) => {
    const { familyCode } = event.params;
    const afterSnap = event.data.after;
    if (!afterSnap || !afterSnap.exists) return;

    const beforeSnap = event.data.before;
    let beforeLog = {};
    let afterLog = {};
    try {
      const beforeRaw = beforeSnap && beforeSnap.exists ? beforeSnap.data().rewardLog : null;
      beforeLog = beforeRaw ? JSON.parse(beforeRaw) : {};
    } catch (e) {
      beforeLog = {};
    }
    try {
      const afterRaw = afterSnap.data().rewardLog;
      afterLog = afterRaw ? JSON.parse(afterRaw) : {};
    } catch (e) {
      afterLog = {};
    }

    // 새로 추가된 보상 선택 항목만 감지
    const newKeys = Object.keys(afterLog).filter((k) => !beforeLog[k]);
    if (newKeys.length === 0) {
      console.log(`[onRewardNotify] ${familyCode}: 새로운 보상 선택 없음`);
      return;
    }

    // rewardLog 키는 Date.now() 문자열이라 숫자형 키 → JS가 자동으로 오름차순 정렬해줌
    const latestEntry = afterLog[newKeys[newKeys.length - 1]] || {};
    const rewardName = latestEntry.name || "보상";

    await sendToTokens(
      familyCode,
      "parent",
      "보상 선택 🎉",
      `"${rewardName}"을(를) 선택했어요!`,
      "onRewardNotify",
      "parent_status"
    );
  }
);

// 카카오 OIDC 로그인 커스텀 토큰 브릿지: 네이티브에서 이미 검증된 Firebase idToken을
// 서버에서 재검증한 뒤, 같은 UID로 커스텀 토큰을 발급해 JS(웹 레이어) auth와 동기화시킴
// (signInWithOpenIdConnect가 nonce를 반환하지 않아 JS signInWithCredential이 막히는 문제 우회)
exports.exchangeKakaoToken = onCall({ region: "us-central1" }, async (request) => {
  const { idToken } = request.data;
  if (!idToken) throw new HttpsError("invalid-argument", "idToken이 없습니다.");
  try {
    const decoded = await admin.auth().verifyIdToken(idToken);
    const customToken = await admin.auth().createCustomToken(decoded.uid);
    return { customToken };
  } catch (e) {
    throw new HttpsError("unauthenticated", "idToken 검증 실패: " + e.message);
  }
});
