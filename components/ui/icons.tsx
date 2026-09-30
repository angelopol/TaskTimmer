"use client";
import React from 'react';

export interface IconProps extends React.SVGProps<SVGSVGElement> {
  size?: number;
  strokeWidth?: number;
}

function createIcon(path: React.ReactNode, displayName: string){
  const C: React.FC<IconProps> = ({ size = 16, strokeWidth = 2, className = '', ...rest }) => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {path}
    </svg>
  );
  C.displayName = displayName;
  return C;
}

export const IconCalendar = createIcon(<>
  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
  <line x1="16" y1="2" x2="16" y2="6" />
  <line x1="8" y1="2" x2="8" y2="6" />
  <line x1="3" y1="10" x2="21" y2="10" />
</>, 'IconCalendar');

export const IconAdd = createIcon(<>
  <line x1="12" y1="5" x2="12" y2="19" />
  <line x1="5" y1="12" x2="19" y2="12" />
</>, 'IconAdd');

export const IconEdit = createIcon(<>
  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5Z" />
</>, 'IconEdit');

export const IconTrash = createIcon(<>
  <path d="M3 6h18" />
  <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  <path d="M10 11v6" />
  <path d="M14 11v6" />
  <path d="M5 6l1 14a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-14" />
</>, 'IconTrash');


export const IconChevronLeft = createIcon(<polyline points="15 18 9 12 15 6" />, 'IconChevronLeft');
export const IconChevronRight = createIcon(<polyline points="9 18 15 12 9 6" />, 'IconChevronRight');

export const IconClock = createIcon(<>
  <circle cx="12" cy="12" r="10" />
  <polyline points="12 6 12 12 16 14" />
</>, 'IconClock');

export const IconSun = createIcon(<><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" /></>, 'IconSun');
export const IconMoon = createIcon(<path d="M20.8 13A9 9 0 0 1 11 3.2 9 9 0 1 0 20.8 13Z" />, 'IconMoon');

export const IconFilter = createIcon(<>
  <path d="M22 3H2l8 10v6l4 2v-8l8-10Z" />
</>, 'IconFilter');

export const IconSave = createIcon(<>
  <path d="M5 2h11l5 5v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Z" />
  <path d="M17 21v-8H7v8" />
  <path d="M7 2v6h8" />
</>, 'IconSave');

export const IconClose = createIcon(<>
  <line x1="18" y1="6" x2="6" y2="18" />
  <line x1="6" y1="6" x2="18" y2="18" />
</>, 'IconClose');

export const IconLayers = createIcon(<>
  <path d="m12 2 8 4-8 4-8-4 8-4Z" />
  <path d="m4 10 8 4 8-4" />
  <path d="m4 18 8 4 8-4" />
</>, 'IconLayers');

export const IconEye = createIcon(<>
  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z" />
  <circle cx="12" cy="12" r="3" />
</>, 'IconEye');

export const IconEyeOff = createIcon(<>
  <path d="M10.58 10.58a2 2 0 1 0 2.83 2.83" />
  <path d="M16.68 16.68A9.89 9.89 0 0 1 12 20c-7 0-11-8-11-8a21.81 21.81 0 0 1 5.06-6.88" />
  <path d="M8.65 3.95A9.9 9.9 0 0 1 12 4c7 0 11 8 11 8a21.83 21.83 0 0 1-2.87 4.15" />
  <line x1="2" y1="2" x2="22" y2="22" />
</>, 'IconEyeOff');

export const IconAlert = createIcon(<>
  <path d="M12 9v4" />
  <path d="M12 17h.01" />
  <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4.27 21h15.46a2 2 0 0 0 2-3Z" />
</>, 'IconAlert');

export const IconHistory = createIcon(<>
  <path d="M3 3v6h6" />
  <path d="M3 13a9 9 0 1 0 3-7.7L3 9" />
  <path d="M12 7v5l4 2" />
</>, 'IconHistory');

export const IconSegment = createIcon(<>
  <rect x="3" y="5" width="18" height="14" rx="2" />
  <path d="M9 5v14" />
  <path d="M15 5v14" />
</>, 'IconSegment');

export const IconActivity = createIcon(<>
  <circle cx="12" cy="12" r="10" />
  <path d="M12 6v6l4 2" />
</>, 'IconActivity');

export const IconLog = createIcon(<>
  <rect x="3" y="4" width="18" height="18" rx="2" />
  <path d="M8 2v4" />
  <path d="M16 2v4" />
  <path d="M7 10h10" />
  <path d="M7 14h6" />
</>, 'IconLog');

export const IconMore = createIcon(<>
  <circle cx="12" cy="5" r="1" />
  <circle cx="12" cy="12" r="1" />
  <circle cx="12" cy="19" r="1" />
</>, 'IconMore');

export const IconHome = createIcon(<>
  <path d="M3 10.5 12 3l9 7.5" />
  <path d="M5 9v11a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9" />
</>, 'IconHome');

export const IconLogout = createIcon(<>
  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
  <polyline points="16 17 21 12 16 7" />
  <line x1="21" y1="12" x2="9" y2="12" />
</>, 'IconLogout');

export const IconList = createIcon(<>
  <path d="M8 6h13" />
  <path d="M8 12h13" />
  <path d="M8 18h13" />
  <path d="M3 6h.01" />
  <path d="M3 12h.01" />
  <path d="M3 18h.01" />
</>, 'IconList');

export const IconBell = createIcon(<>
  <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
  <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
</>, 'IconBell');

export const IconCopy = createIcon(<>
  <rect x="9" y="9" width="13" height="13" rx="2" />
  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
</>, 'IconCopy');

export const IconCheck = createIcon(<polyline points="20 6 9 17 4 12" />, 'IconCheck');

export const IconSearch = createIcon(<>
  <circle cx="11" cy="11" r="7" />
  <path d="m20 20-3.5-3.5" />
</>, 'IconSearch');

export const IconPlay = createIcon(<path d="M7 4.5v15a1 1 0 0 0 1.5.86l12-7.5a1 1 0 0 0 0-1.72l-12-7.5A1 1 0 0 0 7 4.5Z" />, 'IconPlay');
export const IconStop = createIcon(<rect x="6" y="6" width="12" height="12" rx="2" />, 'IconStop');

// Utility mapping if needed later
export const icons = {
  calendar: IconCalendar,
  plus: IconAdd,
  edit: IconEdit,
  trash: IconTrash,
  left: IconChevronLeft,
  right: IconChevronRight,
  clock: IconClock,
  filter: IconFilter,
  save: IconSave,
  close: IconClose,
  layers: IconLayers,
  eye: IconEye,
  eyeOff: IconEyeOff,
  alert: IconAlert,
  history: IconHistory,
  segment: IconSegment,
  activity: IconActivity,
  log: IconLog,
  more: IconMore,
  home: IconHome,
  logout: IconLogout,
  check: IconCheck,
  search: IconSearch,
  play: IconPlay,
  stop: IconStop,
};

export type IconName = keyof typeof icons;
