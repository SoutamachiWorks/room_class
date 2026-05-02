export const ALLOWED_EXTENSIONS = [
  'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx',
  'jpeg', 'jpg', 'png', 'zip', 'rar'
];

export const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

/**
 * Validates a file against allowed extensions and size.
 * @param {File|Blob} file 
 * @returns {{valid: boolean, error?: string}}
 */
export function validateFile(file) {
  if (!file) return { valid: false, error: 'File tidak ditemukan.' };
  
  const name = file.name || '';
  const ext = name.split('.').pop().toLowerCase();
  
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return { valid: false, error: `Format .${ext} tidak diizinkan.` };
  }

  if (file.size > MAX_FILE_SIZE) {
    return { valid: false, error: `Ukuran file "${name}" melebihi batas 50MB.` };
  }
  
  return { valid: true };
}

/**
 * Validates an array of files.
 * @param {File[]} files 
 * @returns {{valid: boolean, errors: string[]}}
 */
export function validateFiles(files) {
  const errors = [];
  for (const file of files) {
    const result = validateFile(file);
    if (!result.valid) {
      errors.push(result.error);
    }
  }
    
  return {
    valid: errors.length === 0,
    errors
  };
}

export const ACCEPT_STR = ALLOWED_EXTENSIONS.map(ext => `.${ext}`).join(',');
