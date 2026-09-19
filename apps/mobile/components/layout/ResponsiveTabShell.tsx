import React from 'react';
import { View } from 'react-native';

/** Keep the navigator at the same tree position when the sidebar appears. */
export function ResponsiveTabShell({ desktop, sidebar, header, children }: {
  desktop: boolean;
  sidebar: React.ReactNode;
  header: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <View style={{ flex: 1, flexDirection: 'row' }}>
      {desktop ? sidebar : null}
      <View style={{ flex: 1 }}>
        {desktop ? header : null}
        <View style={{ flex: 1 }}>{children}</View>
      </View>
    </View>
  );
}
