import { useTranslation } from 'react-i18next';
import { FlagGB, FlagGR, FlagFI, FlagPT, FlagCZ } from './LanguageSelector/FlagIcons';
import { Dropdown } from './Dropdown';

export const LanguageSelector = () => {
  const { i18n, t } = useTranslation();

  const languages = [
    { value: 'en', label: t('languages.en'), icon: <FlagGB /> },
    { value: 'el', label: t('languages.el'), icon: <FlagGR /> },
    { value: 'fi', label: t('languages.fi'), icon: <FlagFI /> },
    { value: 'pt', label: t('languages.pt'), icon: <FlagPT /> },
    { value: 'cs', label: t('languages.cs'), icon: <FlagCZ /> },
  ];

  const handleLanguageChange = (languageCode: string) => {
    i18n.changeLanguage(languageCode);
  };

  return <Dropdown options={languages} selectedValue={i18n.language} onChange={handleLanguageChange} label={t('languages.label', 'Language:')} />;
};
