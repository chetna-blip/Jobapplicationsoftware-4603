import { extractText, getDocumentProxy } from "unpdf";
import { getObjectBytes } from "./s3";
import { truncate } from "./html";

/** Pull plain text out of an uploaded resume stored in Tigris. */
export async function resumeTextFromKey(key: string, filename: string): Promise<string> {
  const bytes = await getObjectBytes(key);

  if (/\.pdf$/i.test(filename)) {
    const pdf = await getDocumentProxy(new Uint8Array(bytes));
    const { text } = await extractText(pdf, { mergePages: true });
    return truncate(normalize(text), 30000);
  }

  // .txt / .md / .doc fallback — decode and strip control noise.
  const text = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  return truncate(normalize(text.replace(/[\u0000-\u0008\u000B-\u001F]/g, " ")), 30000);
}

function normalize(text: string) {
  return text
    .replace(/\r/g, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
