import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import randomInt = require("random-number-csprng");

admin.initializeApp();

export const sendRequest = functions.https.onRequest(
  async (request, response) => {
    try {
      response.set("Access-Control-Allow-Origin", "*");

      const db = admin.database();
      const { clientId } = request.query;
      const dateNow = Date.now();

      if (!clientId) {
        response.statusCode = 400;
        response.send("You did not send the PeerJS client id.");
        return;
      }

      let code = null;
      while (true) {
        const trialCode = await randomInt(100000, 999999);
        const querySnapshot = await db
          .ref("/codes")
          .orderByChild("code")
          .equalTo(trialCode)
          .once("value");

        if (!querySnapshot.exists()) {
          code = trialCode;
          break;
        }

        const documentValue = querySnapshot.val();
        if (documentValue.expireAt >= dateNow) {
          await querySnapshot.ref.remove();
          code = trialCode;
          break;
        }
      }

      const EXPIRY_TIME = 10 * 60 * 1000; // 10 minutes
      const expireAt = dateNow + EXPIRY_TIME;
      await db
        .ref("/codes")
        .push({ code, clientId, expireAt, indexOn: "code" });

      response.send({
        code,
        expireAt,
      });
    } catch (e) {
      // TODO: log the error
      response.statusCode = 500;
      response.send(`Error: ${e.toString()}`);
    }
  },
);

export const receiveRequest = functions.https.onRequest(
  async (request, response) => {
    try {
      response.set("Access-Control-Allow-Origin", "*");

      const db = admin.database();
      const { code } = request.query;
      const dateNow = Date.now();

      if (!code) {
        response.statusCode = 400;
        response.send("You did not send the code.");
        return;
      }

      const querySnapshot = await db
        .ref("/codes")
        .orderByChild("code")
        .equalTo(parseInt(code, 10))
        .once("value");

      if (!querySnapshot.exists()) {
        response.statusCode = 404;
        response.send(`You've requested an invalid code: ${code}`);
        return;
      }

      const documentValue = Object.values(
        querySnapshot.val() as { [key: string]: any },
      )[0];

      if (documentValue.expireAt <= dateNow) {
        response.statusCode = 404;
        response.send(`You've requested an invalid code: ${code}`);
        return;
      }

      response.statusCode = 200;
      console.log(documentValue);
      response.send({
        clientId: documentValue.clientId,
      });

      await querySnapshot.ref.remove();
    } catch (e) {
      // TODO: log the error
      response.statusCode = 500;
      response.send(`Error: ${e.toString()}`);
    }
  },
);
