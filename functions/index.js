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
          await admin.messaging().send({ token, notification: { title, body } });
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
