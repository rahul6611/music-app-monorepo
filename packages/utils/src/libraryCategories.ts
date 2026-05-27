import { categoriesConfig, Category } from './categoriesConfig';

const WESTERN_INSTRUMENT_IDS = [
  'western_violin',
  'classical_piano',
  'blues_jazz_piano',
  'cello',
  'guitar',
];

const PERCUSSION_STYLE_IDS = ['tabla', 'pakhavaj', 'pakhawaj', 'mridangam'];

export interface LibraryUserContext {
  accountType?: string;
  musicSubStyleTypes?: string[];
}

export function getVisibleLibraryCategories(
  userData: LibraryUserContext | null | undefined,
  categories: Category[] = categoriesConfig
): Category[] {
  const styles = (userData?.musicSubStyleTypes || []).map((s) => s.toLowerCase());
  const isWestern =
    styles.length > 0 && styles.every((s) => WESTERN_INSTRUMENT_IDS.includes(s));
  const isAuthorizedForLayaTihai =
    userData?.accountType === 'Instructor' || userData?.accountType === 'SuperAdmin';

  return categories.filter((category) => {
    if (category.hidden) return false;
    if (category.id === 'assignments' && userData?.accountType !== 'Student') return false;

    if (category.westernOnly) return isWestern;
    if (category.indianClassicalOnly && isWestern) return false;

    if ((category.id === 'laya' || category.id === 'tihai') && !isAuthorizedForLayaTihai) {
      return false;
    }

    if (userData?.accountType === 'Instructor' && !isWestern) {
      const isPercussion = styles.some((s) => PERCUSSION_STYLE_IDS.includes(s));
      const isVocalOrMelody = styles.some((s) => !PERCUSSION_STYLE_IDS.includes(s));

      if (
        category.id === 'raag' ||
        category.id === 'songs' ||
        category.id === 'laya' ||
        category.id === 'tihai'
      ) {
        return isVocalOrMelody;
      }
      if (category.id === 'taal') {
        return isPercussion;
      }
    }

    return true;
  });
}
