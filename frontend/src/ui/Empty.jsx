import React from 'react';
import { ClipboardList } from 'lucide-react';

export default function Empty({ text = 'No records available' }) {
  return (
    <div className="empty" role="status">
      <ClipboardList size={28} strokeWidth={1.6}/>
      <p>{text}</p>
    </div>
  );
}
