# Library ટેસ્ટિંગ – સંપૂર્ણ સમજૂતી (ગુજરાતી)

આ એક જ ફાઇલમાં તમારા Music App ના **Library (કન્ટેન્ટ લાઇબ્રેરી)** પેજ માટે લખેલા **બધા ટેસ્ટ** ની સમજૂતી છે.  
દરેક ફાઇલ, દરેક મહત્વની લાઇન, અને **ટેસ્ટ કેવી રીતે ચાલે** તે અહીં ગુજરાતીમાં છે.

---

## ૧. ટેસ્ટિંગ શું છે? (સરળ ભાષા)

જ્યારે તમે **મેન્યુઅલી** ફોન ખોલીને Library જોશો, ત્યારે તમે આંખથી ચેક કરો છો:
- શીર્ષક "Library" દેખાય છે?
- Vocal શિક્ષકને Raag દેખાય પણ Taal નહીં?
- કાર્ડ પર ક્લિક કર્યા પછી detail પેજ ખુલે?

**ઓટોમેટિક ટેસ્ટ** એ જ વસ્તુ કમ્પ્યુટર કરે છે – પણ **નકલી (mock) ડેટા** સાથે, ઝડપથી, વારંવાર.

### ત્રણ પ્રકાર (તમારા નોંધ પ્રમાણે)

| પ્રકાર | શું ચેક થાય | આ પ્રોજેક્ટમાં કઈ ફાઇલ |
|--------|-------------|------------------------|
| **Unit (યુનિટ)** | એક ફંક્શન / લોજિક | `packages/utils/src/__tests__/libraryCategories.test.ts` |
| **UI / Integration** | સ્ક્રીન, બટન, લિસ્ટ, નેવિગેશન | `library.test.tsx`, `library.web.test.tsx` |
| **Manual** | Meend, Kan, સ્વર સ્ટાઇલ વગેરે | હાથથી – આ ટેસ્ટમાં નથી |

### ટેસ્ટની ૩ પગલાં (AAA) – દરેક `it(...)` માં

1. **Arrange (તૈયારી)** – mock ડેટા સેટ કરો, `render(<Library />)`
2. **Act (ક્રિયા)** – `fireEvent.press(...)` – બટન દબાવો
3. **Assert (ચેક)** – `expect(...)` – અપેક્ષા પૂરી થઈ?

---

## ૨. ફાઇલ સ્ટ્રક્ચર – કઈ ફાઇલ શું કરે

```
apps/mobile/app/(tabs)/
├── library.tsx                    ← અસલ Library સ્ક્રીન
└── __tests__/
    ├── library.setup.tsx          ← બધા mock (Firebase, router, theme)
    ├── library.web.setup.tsx      ← Web માટે Platform.OS = 'web'
    ├── library.mocks.ts           ← નકલી યુઝર, raag, taal, songs ડેટા
    ├── library.test.tsx           ← React Native (ફોન) UI ટેસ્ટ – ૧૦
    └── library.web.test.tsx       ← Web UI ટેસ્ટ – ૬

packages/utils/src/
├── libraryCategories.ts           ← કઈ category દેખાય તેનો લોજિક
└── __tests__/
    └── libraryCategories.test.ts  ← લોજિક ટેસ્ટ – ૩
```

**કુલ: ૧૯ ટેસ્ટ** (૧૦ + ૬ + ૩)

---

## ૩. ટેસ્ટ કેવી રીતે ચલાવવા

```bash
# બધા Library UI ટેસ્ટ (Native + Web)
cd apps/mobile
npm test

# માત્ર category લોજિક
cd packages/utils
npm test
```

જ્યારે `PASS` આવે = ટેસ્ટ સફળ. `FAIL` = કોઈક `expect` મેળ ખાતો નથી – કોડ અથવા ટેસ્ટ સુધારવું પડશે.

---

## ૪. Vocal / Instrument / Percussion – શું શું ચેક થાય

| યુઝર પ્રકાર | `musicSubStyleTypes` | દેખાય | ન દેખાય |
|-------------|----------------------|--------|---------|
| **Vocal** | `['vocal']` | Raag, Songs, Laya | Taal |
| **Instrument** (સિતાર) | `['sitar']` | Raag, Exercises | Taal |
| **Percussion** (તબલા) | `['tabla']` | Taal, Exercises | Raag, Songs |

---

# ભાગ A – `library.mocks.ts` (નકલી ડેટા)

આ ફાઇલ **Firebase ની જગ્યાએ** ઉપયોગમાં લેવાય છે. અસલ server ને કૉલ નથી થતી.

```typescript
import { fetchUserData, getAllRaags, ... } from '@music-app/firebase';
```
**લાઇન ૧–૭:** Firebase ફંક્શન import – પછી આને `jest.fn()` થી નકલી બનાવીશું.

```typescript
export const mockRouterPush = jest.fn();
```
**લાઇન ૯:** નેવિગેશન ટ્રેક કરવા. જ્યારે `router.push(...)` થાય, આ ફંક્શન રેકોર્ડ થાય – ટેસ્ટમાં ચેક: યોગ્ય પેજ ખોલ્યું?

```typescript
export const mockAuthUser = { uid: 'instructor-vocal-1' };
```
**લાઇન ૧૧:** લૉગિન યુઝરની નકલ. `uid` દરેક ટેસ્ટમાં બદલી શકાય (student, tabla instructor).

```typescript
export const mockRaagItems = [ { id: 'raag-yaman', name: 'Yaman', ... }, ... ];
```
**લાઇન ૧૩–૨૮:** Raag લિસ્ટની નકલ – Yaman, Bhairav. UI પર આ નામ દેખાય છે કે નહીં તે ચેક થાય.

```typescript
export const mockTaalItems = [ { name: 'Teentaal', ... } ];
```
**લાઇન ૩૦–૩૮:** Percussion માટે Taal ડેટા.

```typescript
export const mockSongItems = [ { name: 'Bandish in Yaman', ... } ];
```
**લાઇન ૪૦–૪૮:** Songs કેટેગરી માટે.

```typescript
export const vocalInstructorProfile = {
  accountType: 'Instructor',
  musicSubStyleTypes: ['vocal'],
  ...
};
```
**લાઇન ૫૦–૫૪:** Vocal શિક્ષકનો profile – `fetchUserData` આ return કરે.

```typescript
export const instrumentInstructorProfile = { musicSubStyleTypes: ['sitar'], ... };
export const percussionInstructorProfile = { musicSubStyleTypes: ['tabla'], ... };
export const studentProfile = { accountType: 'Student', ... };
```
**લાઇન ૫૬–૭૨:** Instrument, Percussion, Student profiles.

```typescript
export function setupFirebaseMocks(profile) {
  (fetchUserData as jest.Mock).mockResolvedValue(profile);
  (getAllRaags as jest.Mock).mockImplementation((collection: string) => {
    if (collection === 'taals') return Promise.resolve(mockTaalItems);
    if (collection === 'songs') return Promise.resolve(mockSongItems);
    return Promise.resolve(mockRaagItems);
  });
  ...
}
```
**લાઇન ૭૪–૮૪:**  
- `fetchUserData` → યુઝર profile આપે  
- `getAllRaags('raags')` → Yaman, Bhairav  
- `getAllRaags('taals')` → Teentaal  
- `getAllRaags('songs')` → Bandish  
એક જ ફંક્શન collection નામ પ્રમાણે અલગ ડેટા આપે.

```typescript
export function setupEmptyLibraryMocks(profile) { ... getAllRaags ... [] }
```
**લાઇન ૮૬–૯૨:** ખાલી લાઇબ્રેરી – "No items found here" ટેસ્ટ માટે.

---

# ભાગ B – `library.setup.tsx` (Mock સેટઅપ)

દરેક UI ટેસ્ટ શરૂઆતમાં `import './library.setup'` કરે છે.

```typescript
export const lightTheme = { background: '#FFFFFF', primary: '#7C3AED', ... };
```
**લાઇન ૩–૧૧:** રંગ/theme નકલ – store વગર UI રેન્ડર થાય.

```typescript
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: require('./library.mocks').mockRouterPush }),
}));
```
**લાઇન ૧૩–૧૫:**  
- `jest.mock` = આ મોડ્યુલની અસલ જગ્યાએ નકલી વર્ઝન  
- `useRouter().push` હવે `mockRouterPush` ને કૉલ કરે – નેવિગેશન ટેસ્ટ શક્ય

```typescript
jest.mock('expo-status-bar', () => ({ StatusBar: () => null }));
```
**લાઇન ૧૭–૧૯:** StatusBar ટેસ્ટમાં જરૂર નથી – `null` રેન્ડર.

```typescript
jest.mock('@music-app/firebase', () => ({
  fetchUserData: jest.fn(),
  getAllRaags: jest.fn(),
  ...
}));
```
**લાઇન ૨૧–૨૭:** Firebase બધું **નકલી ફંક્શન** – `library.mocks.ts` માં `mockResolvedValue` થી ભરવામાં આવે.

```typescript
jest.mock('@music-app/store', () => ({
  useTheme: () => lightTheme,
  useAuthStore: () => ({ user: mockAuthUser, isLoading: false, ... }),
}));
```
**લાઇન ૨૯–૩૭:**  
- `useTheme` → હંમેશા light theme  
- `useAuthStore` → હંમેશા `mockAuthUser` લૉગિન

```typescript
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }) => <View>{children}</View>,
}));
```
**લાઇન ૩૯–૪૬:** SafeAreaView ને સાદા `View` બનાવ્યું – ટેસ્ટ એન્વાયર્નમેન્ટમાં સરળ.

---

# ભાગ C – `library.web.setup.tsx` (Web પ્લેટફોર્મ)

```typescript
import './library.setup';
```
**લાઇન ૧:** પહેલા બધા સામાન્ય mock લોડ.

```typescript
jest.mock('react-native/Libraries/Utilities/Platform', () => ({
  ...Platform,
  OS: 'web',
  select: (spec) => spec.web ?? spec.default ?? spec.native,
}));
```
**લાઇન ૩–૧૧:**  
- `library.tsx` માં `Platform.OS === 'web'` હોય ત્યારે **ScrollView** વપરાય, નહીં તો **FlatList**  
- Web ટેસ્ટ માટે OS ને `'web'` બનાવ્યું – વેબ લેઆઉટ ટેસ્ટ થાય

---

# ભાગ D – `libraryCategories.ts` (લોજિક – કઈ category દેખાય)

આ **UI નથી** – માત્ર ફિલ્ટર લોજિક.

```typescript
const PERCUSSION_STYLE_IDS = ['tabla', 'pakhavaj', 'pakhawaj', 'mridangam'];
```
**લાઇન ૧૧:** Percussion સાધનોની ID.

```typescript
export function getVisibleLibraryCategories(userData, categories = categoriesConfig) {
```
**લાઇન ૧૮–૨૧:** યુઝર ડેટા પ્રમાણે `categoriesConfig` માંથી દેખાતી categories return.

```typescript
const styles = (userData?.musicSubStyleTypes || []).map((s) => s.toLowerCase());
const isWestern = styles.length > 0 && styles.every((s) => WESTERN_INSTRUMENT_IDS.includes(s));
```
**લાઇન ૨૨–૨૪:** Western (piano, guitar) યુઝર છે કે નહીં.

```typescript
if (category.hidden) return false;
```
**લાઇન ૨૯:** છુપાયેલી category ન બતાવો.

```typescript
if (userData?.accountType === 'Instructor' && !isWestern) {
  const isPercussion = styles.some((s) => PERCUSSION_STYLE_IDS.includes(s));
  const isVocalOrMelody = styles.some((s) => !PERCUSSION_STYLE_IDS.includes(s));
```
**લાઇન ૩૯–૪૧:**  
- tabla હોય → percussion  
- vocal/sitar હોય → melody (vocal or instrument)

```typescript
if (category.id === 'raag' || 'songs' || 'laya' || 'tihai') return isVocalOrMelody;
if (category.id === 'taal') return isPercussion;
```
**લાઇન ૪૩–૫૩:**  
- Melody categories માત્ર vocal/instrument માટે  
- Taal માત્ર percussion માટે

---

# ભાગ E – `libraryCategories.test.ts` (Unit ટેસ્ટ – ૩)

```typescript
describe('getVisibleLibraryCategories', () => {
```
**લાઇન ૩:** ટેસ્ટનો જૂથ (ગ્રુપ).

```typescript
it('shows raag, songs, and laya for a vocal instructor', () => {
  const visible = getVisibleLibraryCategories({
    accountType: 'Instructor',
    musicSubStyleTypes: ['vocal'],
  });
  const ids = visible.map((c) => c.id);
  expect(ids).toContain('raag');
  expect(ids).not.toContain('taal');
});
```
**લાઇન ૪–૧૫:**  
- **Act:** ફંક્શન ચલાવો vocal profile સાથે  
- **Assert:** ids માં `raag` છે, `taal` નથી  
ઝડપી – સ્ક્રીન render નથી થતી.

બાકી ૨ ટેસ્ટ: tabla → taal છે, raag નથી; sitar → raag છે, taal નથી.

---

# ભાગ F – `library.test.tsx` (React Native UI – ૧૦ ટેસ્ટ)

```typescript
import './library.setup';
```
**લાઇન ૧:** Mock પહેલા લોડ – Firebase/router નકલી.

```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
```
**લાઇન ૩:**  
- `render` – કમ્પોનન્ટ સ્ક્રીન પર (ટેસ્ટમાં) દોરો  
- `screen` – ટેક્સ્ટ/બટન શોધો  
- `fireEvent.press` – ક્લિક સિમ્યુલેટ  
- `waitFor` – ડેટા લોડ થાય ત્યાં સુધી રાહ જુઓ (async)

```typescript
describe('Library screen (React Native)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthUser.uid = 'instructor-vocal-1';
    setupFirebaseMocks(vocalInstructorProfile);
  });
```
**લાઇન ૨૦–૨૫:**  
- **દરેક ટેસ્ટ પહેલાં:** mock સાફ, default vocal instructor

---

### ટેસ્ટ ૧: Header

```typescript
it('renders the library header and collection subtitle', async () => {
  render(<Library />);
  expect(screen.getByText('Library')).toBeTruthy();
  expect(screen.getByText('Your musical collection')).toBeTruthy();
  await waitFor(() => {
    expect(screen.queryByText('No items found here')).toBeNull();
  });
});
```
- `getByText('Library')` – શીર્ષક હોવું જ જોઈએ  
- `queryByText` – ન મળે તો error નહીં (ખાલી સ્ટેટ ન હોવી જોઈએ એટલે `toBeNull`)

---

### ટેસ્ટ ૨: Vocal – Taal છુપાય

```typescript
await waitFor(() => {
  expect(screen.getByText('Yaman')).toBeTruthy();
  expect(screen.queryByText('Taal')).toBeNull();
});
```
- ડેટા લોડ પછી Yaman દેખાય  
- Taal pill ન દેખાય (vocal instructor)

---

### ટેસ્ટ ૩: Instrument (sitar)

```typescript
mockAuthUser.uid = 'instructor-sitar-1';
setupFirebaseMocks(instrumentInstructorProfile);
```
Profile બદલ્યો – sitar = melody, Taal નહીં.

---

### ટેસ્ટ ૪: Percussion (tabla)

```typescript
await waitFor(() => {
  expect(screen.queryByText('Raag')).toBeNull();
  expect(screen.getByText('Taal')).toBeTruthy();
});
fireEvent.press(screen.getByText('Taal'));
await waitFor(() => expect(screen.getByText('Teentaal')).toBeTruthy());
```
**મહત્વ:** શરૂઆતમાં `activeCategory` હજુ `raag` હોઈ શકે – પહેલા profile લોડ થાય, પછી **Taal** pill દબાવો, પછી Teentaal દેખાય.

---

### ટેસ્ટ ૫: કાર્ડ ટાઇટલ + વર્ણન

Yaman, Bhairav, "Evening raag" સ્ક્રીન પર છે કે નહીં.

---

### ટેસ્ટ ૬: ખાલી સ્ટેટ

`setupEmptyLibraryMocks` → "No items found here"

---

### ટેસ્ટ ૭: કાર્ડ ક્લિક → Detail

```typescript
fireEvent.press(screen.getByText('Yaman'));
expect(mockRouterPush).toHaveBeenCalledWith(
  expect.objectContaining({
    pathname: '/library/raag-yaman',
    params: { category: 'raag', name: 'Yaman' },
  })
);
```
યોગ્ય route પર ગયા કે નહીં – **નેવિગેશન ટેસ્ટ**.

---

### ટેસ્ટ ૮: Add બટન

```typescript
fireEvent.press(screen.getByLabelText('Add to library'));
expect(mockRouterPush).toHaveBeenCalledWith({
  pathname: '/library/create',
  params: { category: 'raag' },
});
```
`library.tsx` માં `accessibilityLabel="Add to library"` એટલે શોધી શકાય.

---

### ટેસ્ટ ૯: Songs pill

```typescript
fireEvent.press(screen.getByText('Songs'));
expect(getAllRaags).toHaveBeenCalledWith('songs');
expect(screen.getByText('Bandish in Yaman')).toBeTruthy();
```
કેટેગરી બદલાય અને Firebase mock માંથી songs આવે.

---

### ટેસ્ટ ૧૦: Student – માત્ર shared/own

```typescript
(getSharedItemIdsForStudent as jest.Mock).mockResolvedValue(['raag-bhairav']);
```
Student માટે માત્ર Bhairav shared – Yaman ન દેખાવો જોઈએ.

---

# ભાગ G – `library.web.test.tsx` (Web – ૬ ટેસ્ટ)

```typescript
import './library.web.setup';
jest.setTimeout(15000);
```
Web થોડો slow – timeout ૧૫ સેકંડ.

ટેસ્ટ્સ Native જેવા જ – પણ `Platform.OS === 'web'` થી **ScrollView + flex-wrap** લેઆઉટ ચાલે.

| # | શું ચેક |
|---|--------|
| ૧ | Web + Vocal – Taal નહીં |
| ૨ | Web + Tabla – Taal, Teentaal |
| ૩ | Web + Sitar – Raag, Taal નહીં |
| ૪ | Web – કાર્ડ press → `/library/raag-yaman` |
| ૫ | Web – Songs switch |
| ૬ | Web – empty state |

---

# ભાગ H – ટેસ્ટ ફ્લો ડાયગ્રામ (તમારા User Flow સાથે)

```
Login (mockAuthUser)
    ↓
Library સ્ક્રીન render
    ↓
fetchUserData (mock profile) → vocal / tabla / sitar
    ↓
getVisibleLibraryCategories → કઈ pills દેખાય
    ↓
getAllRaags / exercises (mock items)
    ↓
UI: કાર્ડ, empty, press, navigate
```

**હજુ ટેસ્ટમાં નથી (ભવિષ્ય / manual):**  
Practice → Record → Instructor feedback, notation meend/kan style.

---

# ભાગ I – `getByText` vs `queryByText` vs `waitFor`

| ફંક્શન | અર્થ |
|--------|------|
| `getByText('Yaman')` | મળે અથવા **ટેસ્ટ ફેલ** |
| `queryByText('Taal')` | મળે અથવા `null` – ફેલ નહીં |
| `expect(...).toBeNull()` | ન દેખાય તે ચેક |
| `waitFor(() => {...})` | ડેટા લોડ થાય ત્યાં સુધી રિટ્રાય |

**શા માટે `waitFor`?**  
`Library` માં `useEffect` થી Firebase કૉલ થાય – પહેલા loading, પછી Yaman દેખાય. તરત `getByText` કરશો તો ફેલ થઈ શકે.

---

# ભાગ J – નવો ટેસ્ટ કેવી રીતે લખવો (સ્ટેપ)

1. **શું ચેક કરવું?** (ઉદા. "Western piano user ne Compositions દેખાય")
2. **Mock ડેટા** `library.mocks.ts` માં profile/item ઉમેરો
3. `library.test.tsx` માં નવું `it('...', async () => { ... })`
4. `render` → `waitFor` → `fireEvent` → `expect`
5. `npm test` ચલાવો

**ઉદાહરણ સ્કેલેટન:**

```typescript
it('મારું નવું ચેક', async () => {
  setupFirebaseMocks(myProfile);
  render(<Library />);
  await waitFor(() => {
    expect(screen.getByText('અપેક્ષિત ટેક્સ્ટ')).toBeTruthy();
  });
});
```

---

# ભાગ K – સામાન્ય ભૂલો અને ઉકેલ

| સમસ્યા | કારણ | ઉકેલ |
|--------|------|------|
| Taal vocal માટે દેખાય | Profile લોડ થાય તે પહેલાં assert | `waitFor` + Yaman સાથે `Taal` null |
| Teentaal ન મળે | Taal pill દબાવ્યા વગર | `fireEvent.press('Taal')` |
| Timeout web પર | Slow first load | `jest.setTimeout(15000)` |
| mockRouterPush 0 calls | Press ખોટા element પર | `getByText` / `getByLabelText` ચેક |

---

# ભાગ L – સારાંશ

| ફાઇલ | ભાષા માં એક વાક્ય |
|------|-------------------|
| `library.mocks.ts` | નકલી યુઝર + raag/taal/songs + Firebase જવાબ |
| `library.setup.tsx` | Router, Firebase, Store, SafeArea નકલ |
| `library.web.setup.tsx` | Web OS નકલ |
| `libraryCategories.ts` | Vocal/Instrument/Percussion category નિયમ |
| `libraryCategories.test.ts` | ઉપરનો નિયમ ઝડપથી ચેક |
| `library.test.tsx` | ફોન UI – ૧૦ વર્તન |
| `library.web.test.tsx` | બ્રાઉઝર UI – ૬ વર્તન |

**યાદ રાખો:**  
- **Mock** = વાસ્તવિક Firebase વગર  
- **Unit** = ફંક્શન  
- **UI** = સ્ક્રીન + ક્લિક + નેવિગેશન  
- **Manual** = notation style, વિઝ્યુઅલ ચીજો  

આ ફાઇલ: `docs/LIBRARY_TESTING_GUJARATI.md` – પ્રોજેક્ટમાં સાચવી રાખો; નવા ટેસ્ટ ઉમેરો ત્યારે અહીં પણ એક લાઇન ઉમેરી શકો.

---

*છેલ્લું અપડેટ: Library ટેસ્ટ સુટ – ૧૯ ટેસ્ટ, apps/mobile + packages/utils*
