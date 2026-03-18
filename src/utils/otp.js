export const generateSecureOTP = (length = 6) => {
    const array = new Uint32Array(1);
    crypto.getRandomValues(array);
    const min = Math.pow(10, length - 1);
    const max = Math.pow(10, length) - 1;
    const range = max - min + 1;
    return String(min + (array[0] % range));
}
