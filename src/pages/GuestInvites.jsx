const randomBytes = new Uint8Array(4);
crypto.getRandomValues(randomBytes);
const otp = Array.from(randomBytes).map((num) => num % 10).join(''); // Generate OTP using crypto.getRandomValues()

// Use generated OTP
