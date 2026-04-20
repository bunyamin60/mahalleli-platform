import { QRCodeSVG } from 'qrcode.react'

function QRSimulator({ code }) {
  return (
    <div className="qr-wrap">
      <div className="qr-real">
        <QRCodeSVG value={code} size={180} bgColor="#ffffff" fgColor="#0f172a" level="M" />
      </div>
      <p className="qr-code">{code}</p>
    </div>
  )
}

export default QRSimulator
