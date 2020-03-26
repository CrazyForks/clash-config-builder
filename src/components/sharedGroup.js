import React from 'react'

import Sortable from 'react-sortablejs';
import uniqueId from 'lodash/uniqueId';

export default function ({ items = [], onChange = () => { } }) {
  const its = items.map(val => {
    return (
      <div className="menu-item" key={uniqueId()} data-id={val}>{val}</div>
    )
  });

  return (
    <Sortable
      options={{
        group: 'shared',
        animation: 150,
      }}
      onChange={onChange}
      className="menu"
    >
      {its}
    </Sortable>
  );
}