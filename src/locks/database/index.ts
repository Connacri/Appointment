/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * proUSB Database Module
 *
 * The original software stores everything in `CardLock.mdb` (Access / JET4).
 * `mdbImport` parses that real file in the browser / WebView / Android, so the
 * app can run on the very same data as `CardLock.exe`.
 */

export * from './mdbImport';
