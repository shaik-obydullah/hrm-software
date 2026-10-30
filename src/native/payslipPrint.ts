import { NativeModules, Platform } from 'react-native';

interface PayslipPrintNativeModule {
  printHtml(html: string, jobName: string): Promise<boolean>;
}

const nativeModule = NativeModules.PayslipPrint as
  | PayslipPrintNativeModule
  | undefined;

/**
 * Opens Android's print dialog for the given HTML. The dialog also offers
 * "Save as PDF", so no extra PDF library is needed.
 */
export async function printHtml(html: string, jobName: string): Promise<void> {
  if (Platform.OS !== 'android' || !nativeModule) {
    throw new Error('Printing is only available in the Android app.');
  }
  await nativeModule.printHtml(html, jobName);
}
