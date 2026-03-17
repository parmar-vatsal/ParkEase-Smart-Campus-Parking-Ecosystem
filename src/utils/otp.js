export function generateSecureOtp() {
    const OTP_RANGE = 900000
    const OTP_BASE = 100000
    const array = new Uint32Array(1)
    const maxUint32 = 0x100000000
    const unbiasedLimit = Math.floor(maxUint32 / OTP_RANGE) * OTP_RANGE
    let value = 0
    do {
        crypto.getRandomValues(array)
        value = array[0]
    } while (value >= unbiasedLimit)
    return String(OTP_BASE + (value % OTP_RANGE))
}
