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
