import React from 'react';

/** Wraps a form control with a consistent visible label. */
export default function Field({ label, children }) {
  return <label className="field"><span>{label}</span>{children}</label>;
}
