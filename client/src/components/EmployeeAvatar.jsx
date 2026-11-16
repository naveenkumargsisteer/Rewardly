import React from 'react';

export default function EmployeeAvatar({
  employee,
  size = 32,
  className = '',
  style = {},
  onClick,
}) {
  const photo =
    employee?.avatar_url ||
    (employee?.avatar_color?.startsWith('data:image/') ? employee.avatar_color : null);

  const initials =
    employee?.avatar_initials ||
    (employee?.full_name || employee?.name || 'EM')
      .split(/\s+/)
      .map((w) => w[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();

  const bgColor =
    employee?.avatar_color && !employee.avatar_color.startsWith('data:image/')
      ? employee.avatar_color
      : '#7C3AED';

  return (
    <span
      className={`avatar ${className}`}
      onClick={onClick}
      style={{
        width: size,
        height: size,
        minWidth: size,
        minHeight: size,
        background: photo ? 'transparent' : bgColor,
        fontSize: Math.max(10, Math.round(size * 0.38)),
        overflow: 'hidden',
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: '50%',
        ...style,
      }}
    >
      {photo ? (
        <img
          src={photo}
          alt={employee?.full_name || employee?.name || 'Employee avatar'}
          className="avatar-img"
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            display: 'block',
            borderRadius: '50%',
          }}
        />
      ) : (
        initials
      )}
    </span>
  );
}

