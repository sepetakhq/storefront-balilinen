import { useEffect, useState } from 'react';

const frame = (size) => ({
  width: size,
  height: size,
  background: 'var(--bl-white)',
  borderRadius: 14,
  border: '1px solid var(--bl-line)',
  padding: 10,
  display: 'grid',
  placeItems: 'center',
  overflow: 'hidden',
});

/**
 * A scannable QR drawn from a payment payload. The encoder is imported lazily
 * so only a buyer with a code to scan downloads it.
 */
export function QrCode({ payload, size = 220 }) {
  const [dataUrl, setDataUrl] = useState('');
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    import('qrcode')
      .then((QR) =>
        QR.toDataURL(payload, { width: size * 2, margin: 1, color: { dark: '#26251F', light: '#FFFFFF' } }),
      )
      .then((url) => !cancelled && setDataUrl(url))
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [payload, size]);

  if (failed) {
    return <QrFailure text="The QR code couldn’t be generated. Use another payment method or contact us." />;
  }

  return (
    <div style={frame(size)}>
      {dataUrl ? (
        <img src={dataUrl} alt="QRIS code" width={size - 20} height={size - 20} />
      ) : (
        <span className="bl-shimmer" style={{ width: '100%', height: '100%' }} />
      )}
    </div>
  );
}

/**
 * A QR the provider drew for us. Indistinguishable from QrCode from the frame
 * outwards, on purpose: a buyer must not be able to tell which gateway served
 * their order.
 */
export function QrImage({ url, size = 220 }) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);

  if (failed) {
    return <QrFailure text="The QR image could not be loaded — it may have expired. Reload the page, or contact us." />;
  }

  return (
    <div style={frame(size)}>
      <img
        src={url}
        alt="QRIS code"
        width={size - 20}
        height={size - 20}
        referrerPolicy="no-referrer"
        onLoad={() => setLoaded(true)}
        onError={() => setFailed(true)}
        style={{ gridArea: '1 / 1', display: loaded ? 'block' : 'none' }}
      />
      {loaded ? null : <span className="bl-shimmer" style={{ gridArea: '1 / 1', width: '100%', height: '100%' }} />}
    </div>
  );
}

function QrFailure({ text }) {
  return (
    <p style={{ fontSize: 12.5, color: 'var(--bl-terra-dark)', maxWidth: 220, lineHeight: 1.6, margin: 0 }}>
      {text}
    </p>
  );
}
