import { useRef, useEffect, useState } from 'react';
import { FontIcon, mergeStyles, initializeIcons } from '@fluentui/react';

initializeIcons();
const arrowClass = mergeStyles({
  fontSize: 10,
  height: 10,
  width: 10,
});

const itemClass = mergeStyles({
  fontSize: 20,
  height: 20,
  width: 20,
})

export function Collapse(props) {
  const {children, title, itemIcon, styles} = props;
  const [isOpen, setIsOpen] = useState(true);

  function handleClick() {
    setIsOpen(!isOpen);
  }

  return (
    <div style={styles} >
      <div onClick={handleClick} style={{ cursor: 'pointer', background: 'rgba(228,230,234,255)', height: 42, display: 'flex', justifyContent: 'space-around', alignItems: 'center', borderRadius: 4 }} >
        <div style={{ display: 'flex', alignItems: 'center', marginRight: 70 }} >
          <FontIcon aria-label="arrow" iconName={itemIcon} className={itemClass} />

          <div style={{ marginLeft: 10, width: 100 }}>
            {title}
          </div>
        </div>
        <FontIcon aria-label="arrow" iconName={isOpen ? 'ChevronDownSmall' : 'ChevronRightSmall'} className={arrowClass} />
      </div>
      {isOpen && children}
    </div>
  )
}