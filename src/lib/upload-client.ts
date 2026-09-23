/**
 * 浏览器端表单上传（带进度 + 一次自动重试）。
 *
 * - 用 XHR 而非 fetch：fetch 拿不到「上传进度」，而手机走公网时上传很慢，
 *   用户需要看到「保存中 42%」而不是干等（PLAN §32）。
 * - 重试策略：只对**网络错误/超时**与 **502/503/504** 重试一次；
 *   4xx（业务错误）与其它 5xx 不重试，避免把已完成的写入重复提交。
 */

export type UploadOutcome = { status: number; data: unknown };

/** 单次 XHR 上传；resolve 出状态码与解析后的 JSON（解析失败给 null） */
function xhrUploadForm(
  url: string,
  method: string,
  body: FormData,
  onProgress: (percent: number) => void,
): Promise<UploadOutcome> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(method, url);
    xhr.responseType = "text";
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      let data: unknown = null;
      try {
        data = JSON.parse(xhr.responseText);
      } catch {
        /* 非 JSON（如 CF 的 524 HTML 页）→ 保持 null */
      }
      resolve({ status: xhr.status, data });
    };
    xhr.onerror = () => reject(new Error("网络中断"));
    xhr.ontimeout = () => reject(new Error("上传超时"));
    xhr.send(body);
  });
}

/** 可重试的状态码：网关类错误（源站大概率没处理完） */
const RETRYABLE_STATUS = new Set([502, 503, 504]);

export async function uploadFormWithRetry(
  url: string,
  method: string,
  body: FormData,
  onProgress: (percent: number) => void,
): Promise<UploadOutcome> {
  try {
    const first = await xhrUploadForm(url, method, body, onProgress);
    if (!RETRYABLE_STATUS.has(first.status)) return first;
    onProgress(0);
    return await xhrUploadForm(url, method, body, onProgress);
  } catch (err) {
    // 网络错误/超时：重试一次；仍失败则把错误抛给调用方
    onProgress(0);
    try {
      return await xhrUploadForm(url, method, body, onProgress);
    } catch {
      throw err;
    }
  }
}
