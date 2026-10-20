import { POST } from '../app/api/v1/email-catcher/route';
import { NextRequest } from 'next/server';

async function test() {
  const req = new NextRequest('http://localhost:3000/api/v1/email-catcher', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'test@163.com',
      fromName: 'Test',
      to: 'fap@fap.qzz.io',
      subject: 'test subject',
      text: 'test text',
      html: '<p>test text</p>',
    })
  });
  const res = await POST(req);
  console.log(res.status);
  console.log(await res.text());
}
test().catch(console.error);
