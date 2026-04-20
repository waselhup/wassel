export interface URLValidationResult {
  valid: boolean;
  normalizedUrl?: string;
  errorCode?: 'feed_url' | 'edit_url' | 'missing_username' | 'not_linkedin' | 'invalid_format';
  errorMessageAr?: string;
  errorMessageEn?: string;
  suggestion?: string;
}

export function validateAndNormalizeLinkedInUrl(rawInput: string): URLValidationResult {
  if (!rawInput || !rawInput.trim()) {
    return {
      valid: false,
      errorCode: 'invalid_format',
      errorMessageAr: 'الرجاء إدخال رابط LinkedIn',
      errorMessageEn: 'Please enter a LinkedIn URL',
    };
  }

  let input = rawInput.trim();

  if (input.startsWith('@')) {
    input = `https://linkedin.com/in/${input.slice(1)}/`;
  }

  if (!input.startsWith('http://') && !input.startsWith('https://')) {
    input = `https://${input}`;
  }

  input = input.replace(/\?.*$/, '');
  input = input.replace(/\/+$/, '');
  input = input.replace(/^https:\/\/www\./, 'https://');

  if (!/linkedin\.com/i.test(input)) {
    return {
      valid: false,
      errorCode: 'not_linkedin',
      errorMessageAr: 'هذا ليس رابط LinkedIn',
      errorMessageEn: 'This is not a LinkedIn URL',
      suggestion: 'الرابط يجب أن يبدأ بـ linkedin.com',
    };
  }

  if (/linkedin\.com\/feed/i.test(input)) {
    return {
      valid: false,
      errorCode: 'feed_url',
      errorMessageAr: 'أدخلت رابط الصفحة الرئيسية، نحتاج رابط بروفايلك',
      errorMessageEn: 'You entered the feed URL, we need your profile URL',
      suggestion: 'اذهب لبروفايلك ثم انسخ الرابط من الأعلى',
    };
  }

  if (/linkedin\.com\/in\/edit/i.test(input)) {
    return {
      valid: false,
      errorCode: 'edit_url',
      errorMessageAr: 'هذا رابط صفحة التعديل، نحتاج رابط البروفايل العام',
      errorMessageEn: 'This is the edit page URL, we need the public profile URL',
      suggestion: 'اضغط على اسمك في LinkedIn ثم انسخ الرابط',
    };
  }

  const profileMatch = input.match(/linkedin\.com\/in\/([^\/\?]+)/i);
  if (!profileMatch || !profileMatch[1] || profileMatch[1].length < 2) {
    return {
      valid: false,
      errorCode: 'missing_username',
      errorMessageAr: 'الرابط لا يحتوي على اسم بروفايل صحيح',
      errorMessageEn: 'URL does not contain a valid profile name',
      suggestion: 'الرابط الصحيح: linkedin.com/in/اسم-المستخدم',
    };
  }

  const username = profileMatch[1];
  const normalizedUrl = `https://linkedin.com/in/${username}/`;

  return {
    valid: true,
    normalizedUrl,
  };
}
