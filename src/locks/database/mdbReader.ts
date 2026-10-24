/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * proUSB CardLock.mdb Database Reader
 * Reads the actual Access/Jet database used by the original CardLock software.
 * Password recovered from RE: "pradlock"
 */

export interface MdbCardInfo {
  ID: number;
  CardData: string;           // Hex string of 16 bytes
  Status: number;             // 0=inactive, 1=active, 2=checked_out, etc.
  Holder: string;             // Guest name
  CardType: number;           // Matches Dai table
  IssueDate: string;
  ExpiryDate: string;
  RoomNo?: string;
  BuildingNo?: number;
  FloorNo?: number;
}

export interface MdbRecordOpen {
  OrderFlag: number;          // 1-33 (slot in lock memory)
  RecData: string;            // 8 bytes hex from lock
  OpenTime: string;           // Timestamp
  CardType: number;
  CardNo?: string;
  RoomNo?: string;
}

export interface MdbDaiMapping {
  CardType: number;           // e.g., 0x60, 0xB0, 0xD0, etc.
  Dai: string;                // Description/Name
}

export interface MdbRegInfo {
  Registor: string;
  RegDate: string;
}

export interface MdbSystemInfo {
  HotelName: string;
  CompanyName: string;
  CheckoutTime: string;
  VIPCheckoutTime: string;
  GuestLLock: number;
  BaoJing: number;
  TiShi: number;
  SA: string;
  SB: string;
  SC: string;
  Skin: string;
  DBBakPath: string;
}

export interface CardLockDatabase {
  cardInfo: MdbCardInfo[];
  recordOpen: MdbRecordOpen[];
  daiMapping: MdbDaiMapping[];
  regInfo: MdbRegInfo[];
  systemInfo: MdbSystemInfo | null;
}

/**
 * Reads CardLock.mdb using a Node.js backend (requires electron/node integration)
 * For browser use, this would need a backend API or WebAssembly SQL.js
 * 
 * This is the interface - actual implementation depends on runtime:
 * - Electron: Use `electron-store` + `adodb` or `node-odbc`
 * - Web: Proxy through a local Node.js server
 * - Capacitor: Use SQLite plugin with Jet/ACE conversion
 */
export class MdbReader {
  private mdbPath: string;
  private password: string = 'pradlock';

  constructor(mdbPath?: string) {
    this.mdbPath = mdbPath || 'C:\\Program Files (x86)\\ProUSB SOFTWARE\\proUSBHotelLockSystem\\CardLock.mdb';
  }

  setPassword(pwd: string) {
    this.password = pwd;
  }

  /**
   * In a real Electron/Node environment, this would use:
   * ```typescript
   * const { OleDb } = require('node-odbc');
   * const conn = new OleDb.Connection();
   * await conn.open(`Provider=Microsoft.Jet.OLEDB.4.0;Data Source=${this.mdbPath};Jet OLEDB:Database Password=${this.password}`);
   * ```
   * 
   * For now, this provides the TYPE definitions and a mock implementation
   * that matches the real schema discovered during RE.
   */
  async connect(): Promise<boolean> {
    // In browser/electron context, would use actual OLEDB/ODBC
    // For now, return true if we can access the file (simulated)
    return true;
  }

  async readCardInfo(): Promise<MdbCardInfo[]> {
    // Real implementation would execute:
    // SELECT ID, CardData, Status, Holder, CardType, IssueDate, ExpiryDate, RoomNo, BuildingNo, FloorNo FROM CardInfo
    return this.getMockCardInfo();
  }

  async readRecordOpen(): Promise<MdbRecordOpen[]> {
    // Real implementation:
    // SELECT OrderFlag, RecData, OpenTime, CardType, CardNo, RoomNo FROM RecordOpen ORDER BY OrderFlag
    return this.getMockRecordOpen();
  }

  async readDaiMapping(): Promise<MdbDaiMapping[]> {
    // Real implementation:
    // SELECT CardType, Dai FROM Dai ORDER BY CardType
    return this.getMockDaiMapping();
  }

  async readRegInfo(): Promise<MdbRegInfo[]> {
    // Real implementation:
    // SELECT Registor, RegDate FROM RegInfo
    return this.getMockRegInfo();
  }

  async readSystemInfo(): Promise<MdbSystemInfo | null> {
    // Real implementation would read from System table or parse System.ini
    return this.getMockSystemInfo();
  }

  async readAll(): Promise<CardLockDatabase> {
    return {
      cardInfo: await this.readCardInfo(),
      recordOpen: await this.readRecordOpen(),
      daiMapping: await this.readDaiMapping(),
      regInfo: await this.readRegInfo(),
      systemInfo: await this.readSystemInfo(),
    };
  }

  // Mock data matching the RE findings - replace with real DB queries in production
  private getMockCardInfo(): MdbCardInfo[] {
    return [
      {
        ID: 1,
        CardData: 'C91224B6E3818101016265DB1565E300',
        Status: 1,
        Holder: 'Karim Mansouri',
        CardType: 0x60,
        IssueDate: '2026-10-23',
        ExpiryDate: '2026-10-27',
        RoomNo: '101',
        BuildingNo: 1,
        FloorNo: 1,
      },
      {
        ID: 2,
        CardData: 'C9121722FF00298000B919D2C029D5FB',
        Status: 1,
        Holder: 'Direction Générale (Passe)',
        CardType: 0xB0,
        IssueDate: '2026-10-20',
        ExpiryDate: '2026-12-31',
      },
      {
        ID: 3,
        CardData: 'C912033BE38582010169E25BC1E26300',
        Status: 1,
        Holder: 'Sophie Benali',
        CardType: 0x60,
        IssueDate: '2026-10-22',
        ExpiryDate: '2026-10-25',
        RoomNo: '205',
        BuildingNo: 2,
        FloorNo: 2,
      },
    ];
  }

  private getMockRecordOpen(): MdbRecordOpen[] {
    return [
      { OrderFlag: 1, RecData: '12ED033BFCC409FF', OpenTime: '2026-10-23T14:22:10', CardType: 0x60, RoomNo: '101' },
      { OrderFlag: 2, RecData: 'FF8481018098FFFF', OpenTime: '2026-10-23T11:05:40', CardType: 0xB0, RoomNo: '101' },
      { OrderFlag: 3, RecData: '033B12EDFCC40900', OpenTime: '2026-10-22T19:40:15', CardType: 0x60, RoomNo: '205' },
      { OrderFlag: 4, RecData: 'A001991580981116', OpenTime: '2026-10-21T08:12:00', CardType: 0xA0, RoomNo: '104' },
    ];
  }

  private getMockDaiMapping(): MdbDaiMapping[] {
    return [
      { CardType: 0x00, Dai: 'Reset/IniCard' },
      { CardType: 0x10, Dai: 'Record/Audit Card' },
      { CardType: 0x20, Dai: 'Room Set Card' },
      { CardType: 0x30, Dai: 'Time Set Card' },
      { CardType: 0x40, Dai: 'Limit/Blacklist Card' },
      { CardType: 0x50, Dai: 'Group Set Card' },
      { CardType: 0x60, Dai: 'Guest Card' },
      { CardType: 0x70, Dai: 'Check-Out Card' },
      { CardType: 0x80, Dai: 'Group Card' },
      { CardType: 0xA0, Dai: 'Emergency Card' },
      { CardType: 0xB0, Dai: 'Master Card' },
      { CardType: 0xC0, Dai: 'Building Card' },
      { CardType: 0xD0, Dai: 'Floor Card' },
    ];
  }

  private getMockRegInfo(): MdbRegInfo[] {
    return [
      { Registor: 'proM9-20121130-14', RegDate: '2012-11-30' },
      { Registor: 'proUSB20140107', RegDate: '2014-01-07' },
    ];
  }

  private getMockSystemInfo(): MdbSystemInfo {
    return {
      HotelName: 'Grand Hotel Oran',
      CompanyName: 'OmniBook Luxury Hotel & Clinic',
      CheckoutTime: '12:00:00',
      VIPCheckoutTime: '14:00:00',
      GuestLLock: 1,
      BaoJing: 128,
      TiShi: 152,
      SA: '708EE4C560EDC47C',
      SB: '231212',
      SC: '4080',
      Skin: 'mxskin20.skn',
      DBBakPath: 'D:\\proUSB_DBBak',
    };
  }
}

// Singleton instance for app-wide use
export const mdbReader = new MdbReader();

/**
 * Electron/Node.js backend implementation example:
 * 
 * // In electron/main.ts or a Node.js server:
 * import { OleDb } from 'node-odbc';
 * import { MdbReader, CardLockDatabase } from './mdbReader';
 * 
 * class ElectronMdbReader extends MdbReader {
 *   private connection: any;
 * 
 *   async connect(): Promise<boolean> {
 *     const connStr = `Provider=Microsoft.Jet.OLEDB.4.0;Data Source=${this.mdbPath};Jet OLEDB:Database Password=${this.password}`;
 *     this.connection = new OleDb.Connection();
 *     try {
 *       await this.connection.open(connStr);
 *       return true;
 *     } catch (e) {
 *       // Try ACE provider for .accdb or newer Jet
 *       const aceConnStr = `Provider=Microsoft.ACE.OLEDB.12.0;Data Source=${this.mdbPath};Jet OLEDB:Database Password=${this.password}`;
 *       this.connection = new OleDb.Connection();
 *       await this.connection.open(aceConnStr);
 *       return true;
 *     }
 *   }
 * 
 *   async query(sql: string): Promise<any[]> {
 *     const cmd = this.connection.createCommand();
 *     cmd.commandText = sql;
 *     const result = await cmd.executeReader();
 *     const rows = [];
 *     while (await result.read()) {
 *       const row: any = {};
 *       for (let i = 0; i < result.fieldCount; i++) {
 *         row[result.getName(i)] = result.getValue(i);
 *       }
 *       rows.push(row);
 *     }
 *     return rows;
 *   }
 * 
 *   async readCardInfo() {
 *     const rows = await this.query('SELECT ID, CardData, Status, Holder, CardType, IssueDate, ExpiryDate, RoomNo, BuildingNo, FloorNo FROM CardInfo');
 *     return rows.map(r => ({
 *       ...r,
 *       CardData: Buffer.from(r.CardData).toString('hex').toUpperCase(),
 *     }));
 *   }
 * }
 */