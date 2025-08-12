import React from 'react';

export default function PageHeader({ title, time, date }) {
  return (
    <div className="page-header">
      <div className="page-header-title">{title}</div>
      <div className="page-header-datetime">
        <span className="page-header-time">{time}</span>
        <span className="page-header-date">{date}</span>
      </div>
    </div>
  );
}
