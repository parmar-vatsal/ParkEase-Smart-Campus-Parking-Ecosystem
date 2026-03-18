export const ROLES = {
    STUDENT: 'student',
    FACULTY: 'faculty',
    STAFF: 'staff',
    GUARD: 'guard',
    ADMIN: 'admin'
}

export const DEPARTMENTS = [
    'Computer Engineering',
    'Information Technology',
    'Artificial Intelligence',
    'Electronics & Communication',
    'Electronics & Instrumentation',
    'Electrical Engineering',
    'Civil Engineering',
    'Mechanical Engineering',
    'Chemical Engineering',
    'Textile Technology',
    'Other'
]

export const VEHICLE_LIMITS = {
    student: { two_wheeler: 1, four_wheeler: 0 },
    faculty: { two_wheeler: 2, four_wheeler: 1 },
    staff: { two_wheeler: 1, four_wheeler: 1 },
    admin: { two_wheeler: 2, four_wheeler: 2 }
}

export const MAX_PHOTO_SIZE_MB = 5;
export const MAX_PHOTO_BYTES = MAX_PHOTO_SIZE_MB * 1024 * 1024;
export const COOLDOWN_DAYS = 90;

export const POLLING_INTERVALS = {
    CAPACITY: 10000,
    LOGS: 15000,
    WALKINS: 20000
}