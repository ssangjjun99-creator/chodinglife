const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const axios = require("axios");

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
