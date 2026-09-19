// Browser regression fixture: visible frames must all have the final column widths.
import React, { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, Text } from 'react-native';
import { buildNotationTableSections } from '@music-app/utils';
import NotationTableEnhanced from '../../apps/mobile/components/notation/NotationTableEnhanced';

const sections = buildNotationTableSections([
  { phraseId: 'short', sectionLabel: 'Sthayi', entries: [{ beat: 1, swar: 'S' }] },
  { phraseId: 'long', sectionLabel: 'Antara', entries: [
    { beat: 1, swar: '/md S R G M P D N S /' },
    { beat: 2, swar: '/2 S R G M P D N S R G M P /' },
    { absoluteBeat: 11, swar: '/mu S R G M P D N S /' },
  ] },
]);
const largeSections = Array.from({ length: 30 }, (_, i) => ({ ...sections[i % sections.length], label: `Phrase ${i + 1}` }));

export default function NotationOpeningFixture() {
  const [open, setOpen] = useState(false);
  const [empty, setEmpty] = useState(false);
  const [large, setLarge] = useState(false);
  const [report, setReport] = useState('Not checked');
  const run = useRef(0);
  const observerRef = useRef<MutationObserver | null>(null);
  useEffect(() => () => { ++run.current; observerRef.current?.disconnect(); }, []);
  const show = (blank = false, many = false) => {
    const id = ++run.current;
    observerRef.current?.disconnect();
    setEmpty(blank);
    setLarge(many);
    setOpen(true);
    setReport('Checking frames');
    if (typeof document === 'undefined') return;
    const started = performance.now();
    const visibleWidths: string[] = [];
    let readyMs: number | null = null;
    observerRef.current = new MutationObserver(() => {
      const table = document.querySelector('[data-testid="notation-table-layout"]');
      if (table && getComputedStyle(table).opacity === '1') {
        readyMs = Math.round(performance.now() - started);
        observerRef.current?.disconnect();
      }
    });
    observerRef.current.observe(document.body, { attributes: true, childList: true, subtree: true });
    let frames = 0;
    const sample = () => {
      if (id !== run.current) return;
      const table = document.querySelector('[data-testid="notation-table-layout"]');
      if (table && getComputedStyle(table).opacity === '1') {
        visibleWidths.push(JSON.stringify(Array.from(table.querySelectorAll('[data-testid^="notation-header-"]'))
          .map(cell => Math.round(cell.getBoundingClientRect().width * 100) / 100)));
      }
      if (++frames < 12) requestAnimationFrame(sample);
      else setReport(JSON.stringify({ readyMs, visibleFrames: visibleWidths.length, visibleLayouts: new Set(visibleWidths).size }));
    };
    requestAnimationFrame(sample);
  };
  if (!__DEV__) return null;
  return <ScrollView style={{ flex: 1, backgroundColor: '#fff', padding: 12 }}>
    <Pressable accessibilityRole="button" onPress={() => show()}><Text>Open notation fixture</Text></Pressable>
    <Pressable accessibilityRole="button" onPress={() => show(true)}><Text>Open empty fixture</Text></Pressable>
    <Pressable accessibilityRole="button" onPress={() => show(false, true)}><Text>Open large fixture</Text></Pressable>
    <Pressable accessibilityRole="button" onPress={() => { ++run.current; setOpen(false); }}><Text>Close fixture</Text></Pressable>
    <Text testID="opening-report">{report}</Text>
    {open && <NotationTableEnhanced sections={empty ? [] : large ? largeSections : sections} beatsPerCycle={10} taalName="Jhaptal" />}
  </ScrollView>;
}
