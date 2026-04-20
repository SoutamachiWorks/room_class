/**
 * Executes a Multipart Form Data upload using XMLHttpRequest to track progress.
 * @param {string} url - The API endpoint to hit
 * @param {FormData} formData - The payload containing files
 * @param {string} method - HTTP method (POST or PUT), default POST
 * @param {function} onProgress - Callback passing integer 0-100 `(progress) => {}`
 * @returns {Promise<any>} The parsed JSON response
 */
export function uploadWithProgress(url, formData, method = 'POST', onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(method, url, true);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        const percentComplete = Math.round((event.loaded / event.total) * 100);
        if (onProgress) onProgress(percentComplete);
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const response = JSON.parse(xhr.responseText);
          resolve(response);
        } catch (e) {
          resolve(xhr.responseText);
        }
      } else {
        try {
          const errRes = JSON.parse(xhr.responseText);
          const err = new Error(errRes.error || `HTTP ${xhr.status}`);
          err.payload = errRes;
          reject(err);
        } catch (e) {
          const fallbackErr = new Error(`HTTP ${xhr.status} Request Failed`);
          fallbackErr.payload = {};
          reject(fallbackErr);
        }
      }
    };

    xhr.onerror = () => {
      reject(new Error('Koneksi jaringan terputus saat mengunggah.'));
    };

    xhr.send(formData);
  });
}
