import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { ScanLine } from 'lucide-react';

/** Scanner lifecycle lives in one mounted component, preventing React unmount/start races. */
export default function CameraScanner({ active, onScan, onError }) {
  const holder = useRef(null);
  const onScanRef = useRef(onScan);
  const onErrorRef = useRef(onError);
  const [state, setState] = useState('idle');
  const [message, setMessage] = useState('');
  const [cameras, setCameras] = useState([]);
  const [selected, setSelected] = useState('');
  const [runningCameraId, setRunningCameraId] = useState('');
  const [fileBusy, setFileBusy] = useState(false);
  const scanLock = useRef(false);
  onScanRef.current = onScan;
  onErrorRef.current = onError;

  useEffect(() => {
    if (!active) {setState('idle');setMessage('');return;}
    let cancelled = false;
    let reader = null;
    scanLock.current = false;

    async function start() {
      if (!window.isSecureContext) {
        setState('error');setMessage('Camera access requires HTTPS or http://localhost. A LAN IP over HTTP will not work.');return;
      }
      if (!navigator.mediaDevices?.getUserMedia) {
        setState('error');setMessage('This browser does not support camera access. Try Chrome or Edge.');return;
      }
      setState('loading');setMessage('Requesting camera access…');
      try {
        // Call getUserMedia first: opens the permission prompt and exposes device labels.
        const stream = await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:{ideal:'environment'}}});
        stream.getTracks().forEach(track => track.stop());
        if (cancelled) return;
        const devices = await Html5Qrcode.getCameras();
        if (cancelled) return;
        setCameras(devices);
        if (!devices.length) throw new Error('No cameras detected. Connect a camera and try again.');
        const preferred = selected && devices.find(d => d.id === selected)
          || devices.find(d => /back|rear|environment/i.test(d.label)) || devices[0];
        setRunningCameraId(preferred.id);
        reader = new Html5Qrcode(holder.current.id,{verbose:false});
        await reader.start(preferred.id,{fps:10,qrbox:(width,height)=>{
          const side = Math.max(120,Math.min(250,Math.floor(Math.min(width,height)*0.72)));
          return {width:side,height:side};
        }}, decoded => {
          if (scanLock.current || cancelled) return;
          scanLock.current = true;
          onScanRef.current(decoded);
        },()=>{});
        if (cancelled) {await reader.stop().catch(()=>{});reader.clear();return;}
        setState('running');setMessage('Point the camera at the permit QR code.');
      } catch (err) {
        if (cancelled) return;
        const type = err?.name || '';
        const info = type === 'NotAllowedError' ? 'Camera permission was denied. Allow camera access in browser site settings and retry.'
          : type === 'NotFoundError' ? 'No camera found on this device.'
          : type === 'NotReadableError' ? 'The camera is in use by another application. Close it and retry.'
          : err?.message || 'Unable to start the camera.';
        setState('error');setMessage(info);onErrorRef.current(info);
      }
    }
    start();
    return () => {
      cancelled = true;
      scanLock.current = true;
      if (reader) {
        const cleanup = async () => {try { if (reader.isScanning) await reader.stop(); } catch {} try {reader.clear();} catch {}};
        cleanup();
      }
    };
  }, [active, selected]);

  async function scanFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileBusy(true);
    let reader;
    try {
      // This library can decode QR images without camera access.
      const element = holder.current;
      reader = new Html5Qrcode(element.id,{verbose:false});
      const value = await reader.scanFile(file, false);
      onScanRef.current(value);
    } catch (err) {
      const info = err?.message || 'Could not read a QR code from that picture.';
      setMessage(info);onErrorRef.current(info);
    } finally {
      if (reader) {try {reader.clear();} catch {}}
      setFileBusy(false);e.target.value='';
    }
  }

  return <div className="scanner-space camera-scanner">
    <div ref={holder} id="campus-camera-reader" className="camera-video" style={{display:active ? 'block':'none'}} />
    {!active && <><div className="scan-frame"><ScanLine size={65}/></div><strong>Ready to scan</strong><p>Open your camera or paste a QR payload below.</p></>}
    {active && <div className={'camera-status '+(state==='error'?'camera-error':'')} role="status">{message || 'Starting scanner…'}</div>}
    {!active && <label className="qr-upload-label">Scan an uploaded QR photo<input type="file" accept="image/*" disabled={fileBusy} onChange={scanFile}/></label>}
    {active && cameras.length > 1 && <label className="camera-selector">Camera <select value={selected || runningCameraId} onChange={e => setSelected(e.target.value)}>{cameras.map(c=><option key={c.id} value={c.id}>{c.label || 'Camera'}</option>)}</select></label>}
  </div>;
}
