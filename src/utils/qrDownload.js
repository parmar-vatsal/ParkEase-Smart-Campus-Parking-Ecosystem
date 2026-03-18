export const downloadQR = (elementId, filename = 'QR_Code.png', width = 300, height = 400) => {
    const svg = document.getElementById(elementId)
    if (!svg) return

    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    const data = new XMLSerializer().serializeToString(svg)
    const img = new Image()
    const svgBlob = new Blob([data], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(svgBlob)

    img.onload = () => {
        canvas.width = width
        canvas.height = height

        // Fill white background
        ctx.fillStyle = 'white'
        ctx.fillRect(0, 0, canvas.width, canvas.height)

        // Draw QR code (center it horizontally, leave space at bottom)
        const qrSize = Math.min(width, height - 100)
        const xOffset = (width - qrSize) / 2
        ctx.drawImage(img, xOffset, 20, qrSize, qrSize)

        // Draw text
        ctx.fillStyle = '#0f172a'
        ctx.font = 'bold 20px sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText('ParkEase Scan', width / 2, qrSize + 40)

        // Trigger download
        const pngUrl = canvas.toDataURL('image/png')
        const downloadLink = document.createElement('a')
        downloadLink.href = pngUrl
        downloadLink.download = filename
        document.body.appendChild(downloadLink)
        downloadLink.click()
        document.body.removeChild(downloadLink)
        URL.revokeObjectURL(url)
    }
    img.src = url
}

export const generatePassString = (type, sponsorName, guestName, vehicleNumber, durationHours) => {
    const expiry = new Date()
    if (durationHours) {
        expiry.setHours(expiry.getHours() + parseInt(durationHours))
    }
    return JSON.stringify({
        type: type,
        sn: sponsorName,
        gn: guestName,
        vn: vehicleNumber,
        exp: expiry.getTime()
    })
}

export const downloadGuestPassQR = (pass) => {
    const svg = document.getElementById(`admin-qr-${pass.id}`)
    if (!svg) return

    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    const data = new XMLSerializer().serializeToString(svg)
    const img = new Image()
    const svgBlob = new Blob([data], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(svgBlob)

    img.onload = () => {
        canvas.width = 300
        canvas.height = 400
        ctx.fillStyle = 'white'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        ctx.drawImage(img, 30, 20, 240, 240)

        ctx.fillStyle = '#1e293b'
        ctx.font = 'bold 20px Inter, sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText('GUEST PARKING PASS', 150, 290)

        ctx.font = 'bold 16px Inter, sans-serif'
        ctx.fillStyle = '#6366f1'
        ctx.fillText(pass.vehicle_number, 150, 315)

        ctx.font = '12px Inter, sans-serif'
        ctx.fillStyle = '#64748b'
        ctx.fillText(`Guest: ${pass.guest_name} (Event/VIP)`, 150, 340)

        const expiryTime = new Date(pass.valid_until).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        ctx.fillStyle = '#f43f5e'
        ctx.fillText(`Valid Until: ${expiryTime}`, 150, 360)

        ctx.fillStyle = '#94a3b8'
        ctx.fillText(`OTP: ${pass.otp_code}`, 150, 380)

        const link = document.createElement('a')
        link.download = `EventPass_${pass.vehicle_number}.png`
        link.href = canvas.toDataURL('image/png')
        link.click()
        URL.revokeObjectURL(url)
    }
    img.src = url
}
