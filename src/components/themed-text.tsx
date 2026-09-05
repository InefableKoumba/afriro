import { StyleSheet, Text, type TextProps } from 'react-native';

import { Fonts, ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ThemedTextProps = TextProps & {
  type?: 'default' | 'body' | 'title' | 'display' | 'subtitle' | 'label' | 'caption' | 'code' | 'small' | 'smallBold' | 'link' | 'linkPrimary';
  themeColor?: ThemeColor;
};

export function ThemedText({ style, type = 'default', themeColor, ...rest }: ThemedTextProps) {
  const theme = useTheme();

  return (
    <Text
      style={[
        { color: theme[themeColor ?? 'text'] },
        (type === 'default' || type === 'body') && styles.default,
        type === 'display' && styles.display,
        type === 'title' && styles.title,
        type === 'subtitle' && styles.subtitle,
        type === 'label' && styles.label,
        type === 'caption' && styles.caption,
        type === 'code' && styles.code,
        type === 'small' && styles.small,
        type === 'smallBold' && styles.smallBold,
        type === 'link' && styles.link,
        type === 'linkPrimary' && [styles.linkPrimary, { color: theme.accentPrimary }],
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  display: {
    fontFamily: Fonts.display,
    fontSize: 32,
    lineHeight: 38,
    fontWeight: '500',
  },
  title: {
    fontFamily: Fonts.display,
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '500',
  },
  subtitle: {
    fontFamily: Fonts.display,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '500',
  },
  default: {
    fontFamily: Fonts.ui,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '400',
  },
  label: {
    fontFamily: Fonts.ui,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '400',
  },
  caption: {
    fontFamily: Fonts.ui,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '400',
  },
  small: {
    fontFamily: Fonts.ui,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '400',
  },
  smallBold: {
    fontFamily: Fonts.ui,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
  },
  code: {
    fontFamily: Fonts.mono,
    fontSize: 12,
    fontWeight: '400',
  },
  link: {
    fontFamily: Fonts.ui,
    fontSize: 14,
    lineHeight: 20,
    textDecorationLine: 'underline',
  },
  linkPrimary: {
    fontFamily: Fonts.ui,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
  },
});
