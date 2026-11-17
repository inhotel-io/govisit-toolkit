/** @jsx jsx */
import {jsx} from 'theme-ui';
export const MailIcon = ({onClick}: {onClick?: (e: any) => void}) => {
  return (
    <svg
      focusable="false"
      aria-hidden="true"
      viewBox="0 0 23 23"
      sx={{
        height: '2em',
        width: '2em',
      }}
      onClick={onClick}
    >
      <path
        fill="#9a9b9b"
        fillRule="evenodd"
        d="M2 7a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7Zm2 1.18V16a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V8.18l-8 5-8-5ZM18.113 7H5.887L12 10.82 18.113 7Z"
      ></path>
    </svg>
  );
};

export default MailIcon;
