import React from 'react';
import { Search } from 'lucide-react';

export default function SearchBox({ value, onChange, placeholder = 'Search records…' }) {
  return (
    <div className="search">
      <Search size={17}/>
      <input
        type="search"
        value={value}
        onChange={event => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
      />
    </div>
  );
}
