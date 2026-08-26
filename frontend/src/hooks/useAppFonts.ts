import { useFonts } from 'expo-font';

export function useAppFonts() {
  return useFonts({
    Italiana: 'https://fonts.gstatic.com/s/italiana/v20/QldNNTtLsx4E__B0XTmRY31Wx7Vv.ttf',
    DMSans: 'https://fonts.gstatic.com/s/dmsans/v14/rP2Hp2ywxg089UriI5-g4vlH9VoD8Cmcqbu4.ttf',
    DMSansMedium: 'https://fonts.gstatic.com/s/dmsans/v14/rP2Hp2ywxg089UriI5-g7vlH9VoD8CmcqbG24DTyEg.ttf',
    DMSansBold: 'https://fonts.gstatic.com/s/dmsans/v14/rP2Hp2ywxg089UriI5-g7vlH9VoD8CmcqbEu3TTyEg.ttf',
  });
}
