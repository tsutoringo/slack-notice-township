import puppeteer, { Browser, Page } from 'puppeteer';
import { IncomingWebhook } from '@slack/webhook';
import fs from 'fs/promises';
import fetch from 'node-fetch';
import crypto from 'crypto';

const BASE_URL =
  'https://967phuchye.execute-api.ap-southeast-2.amazonaws.com/prod/api';

(async () => {
  const contentConfig = await fs.readFile('config.json', 'utf8');

  const config = JSON.parse(contentConfig);

  const headers = {
    'Content-Type': 'application/json',
    'X-API-Key': config.apiKey,
  };

  let contentLastUsernames: any;
  let lastUsernams: string[];
  try {
    contentLastUsernames = await fs.readFile('usernames.json', 'utf8');
    lastUsernams = JSON.parse(contentLastUsernames);
  } catch {
    lastUsernams = [];
  }

  const hashPassword = crypto.createHash('sha512');
  hashPassword.update(config.password);

  const tokens: {
    access_token: string;
    identity_token: string;
    refresh_token: string;
    request_model_errors?: any;
  } = await (
    await fetch(`${BASE_URL}/sessions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        username: config.username,
        password_hash: hashPassword.digest('hex'),
      }),
    })
  ).json();

  const server = await (
    await fetch(`${BASE_URL}/servers/${config.serverID}`, {
      method: 'GET',
      headers: Object.assign(
        {
          Authorization: `Bearer ${tokens.access_token}`,
        },
        headers
      ),
    })
  ).json();

  const usernames: string[] = server.online_players.map(
    (player: { id: number; username: string }) => player.username
  );

  await fs.writeFile('usernames.json', JSON.stringify(usernames));

  let join: string[] = [];
  let left: string[] = [];

  usernames.forEach((u) => {
    if (!lastUsernams.includes(u)) {
      join.push(u);
    }
  });

  lastUsernams.forEach((u) => {
    if (!usernames.includes(u)) {
      left.push(u);
    }
  });

  let message = '';
  if (join.length > 0) {
    message += '*Join to server* : ' + join.join(', ') + '\n';
  }

  if (left.length > 0) {
    message += '*Left from server* : ' + left.join(', ') + '\n';
  }

  if (join.length + left.length > 0) {
    message +=
      `*Current members(${usernames.length})* : ` + usernames.join(', ');
    console.log('[INFO] === POST MESSAGE START ===');
    console.log(message);
    console.log('[INFO] === POST MESSAGE END ===');
    // const webhook = new IncomingWebhook(config.webhookURL);
    // await webhook.send({
    //   text: message,
    // });
  } else {
    console.log("[INFO] The members didn't change.");
  }

  // await page.screenshot({ path: 'debug.png' }); // for debug
  console.log('[INFO] Finished.');
})();
