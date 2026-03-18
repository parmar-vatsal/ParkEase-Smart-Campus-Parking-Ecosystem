export const isValidVehicleNumber = (vn) => {
    // Standard Indian Vehicle Number Format: GJ05AB1234
    return /^[A-Z]{2}[0-9]{2}[A-Z]{1,2}[0-9]{4}$/.test(vn);
}

export const formatVehicleNumber = (vn) => {
    return vn.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);
}

export const isValidPhone = (phone) => {
    return /^[0-9]{10}$/.test(phone);
}