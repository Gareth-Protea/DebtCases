import axios from "axios";
import xml2js from "xml2js";
import { SOAPEncryption, SOAP_CONFIG } from "./soap-encryption";
import { log } from "./index";

/**
 * SOAP Client for querying Metermis and Readings databases
 */
export class SOAPClient {
  private baseUrl: string;

  constructor() {
    this.baseUrl = SOAP_CONFIG.baseUrl;
  }

  /**
   * Execute SQL query against Metermis database
   */
  async queryMetermis(sql: string): Promise<any> {
    return this.query(sql, "Metermis");
  }

  /**
   * Execute INSERT/UPDATE/DELETE against Metermis database.
   * Bypasses the SELECT-only validateSQL() guard — only allows safe DML.
   */
  async writeMetermis(sql: string): Promise<any> {
    const upper = sql.trim().toUpperCase();
    const allowed = ['INSERT', 'UPDATE', 'DELETE'];
    if (!allowed.some(k => upper.startsWith(k))) {
      throw new Error(`writeMetermis only allows INSERT/UPDATE/DELETE. Got: ${upper.substring(0, 20)}`);
    }
    // Block truly dangerous statements that could slip through
    const blocked = ['DROP', 'ALTER', 'TRUNCATE', 'EXEC', 'EXECUTE', 'SP_', 'CREATE'];
    for (const kw of blocked) {
      const pattern = new RegExp(`\\b${kw}\\b`);
      if (pattern.test(upper)) {
        throw new Error(`writeMetermis blocked dangerous keyword: ${kw}`);
      }
    }
    // Same encrypted SOAP call to QueryMetermis, just skip validateSQL()
    const payload = SOAPEncryption.createPayload(sql);
    const soapEnvelope = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" 
               xmlns:xsd="http://www.w3.org/2001/XMLSchema" 
               xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <QueryMetermis xmlns="http://tempuri.org/">
      <payload>${this.escapeXml(payload)}</payload>
    </QueryMetermis>
  </soap:Body>
</soap:Envelope>`;
    try {
      const response = await axios.post(this.baseUrl, soapEnvelope, {
        headers: {
          "Content-Type": "text/xml; charset=utf-8",
          SOAPAction: "http://tempuri.org/QueryMetermis",
        },
        timeout: 30000,
      });
      return response.data;
    } catch (error: any) {
      throw this.handleError(error);
    }
  }

  /**
   * Execute SQL query against Readings database
   */
  async queryReadings(sql: string): Promise<any> {
    return this.query(sql, "Readings");
  }

  /**
   * Execute INSERT/UPDATE/DELETE against Readings database (UserAccounts etc.)
   * Bypasses the SELECT-only validateSQL() guard — only allows safe DML.
   */
  async writeReadings(sql: string): Promise<any> {
    const upper = sql.trim().toUpperCase();
    const allowed = ['INSERT', 'UPDATE', 'DELETE'];
    if (!allowed.some(k => upper.startsWith(k))) {
      throw new Error(`writeReadings only allows INSERT/UPDATE/DELETE. Got: ${upper.substring(0, 20)}`);
    }
    const blocked = ['DROP', 'ALTER', 'TRUNCATE', 'EXEC', 'EXECUTE', 'SP_', 'CREATE'];
    for (const kw of blocked) {
      const pattern = new RegExp(`\\b${kw}\\b`);
      if (pattern.test(upper)) {
        throw new Error(`writeReadings blocked dangerous keyword: ${kw}`);
      }
    }
    const payload = SOAPEncryption.createPayload(sql);
    const soapEnvelope = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" 
               xmlns:xsd="http://www.w3.org/2001/XMLSchema" 
               xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <QueryReadings xmlns="http://tempuri.org/">
      <payload>${this.escapeXml(payload)}</payload>
    </QueryReadings>
  </soap:Body>
</soap:Envelope>`;
    try {
      const response = await axios.post(this.baseUrl, soapEnvelope, {
        headers: {
          "Content-Type": "text/xml; charset=utf-8",
          SOAPAction: "http://tempuri.org/QueryReadings",
        },
        timeout: 30000,
      });
      return response.data;
    } catch (error: any) {
      throw this.handleError(error);
    }
  }

  /**
   * Execute SQL query via SOAP
   */
  private async query(sql: string, database: "Metermis" | "Readings"): Promise<any> {
    // Validate SQL
    const validation = SOAPEncryption.validateSQL(sql);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    // Create encrypted payload
    const payload = SOAPEncryption.createPayload(sql);

    // Build SOAP envelope
    const soapEnvelope = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" 
               xmlns:xsd="http://www.w3.org/2001/XMLSchema" 
               xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <Query${database} xmlns="http://tempuri.org/">
      <payload>${this.escapeXml(payload)}</payload>
    </Query${database}>
  </soap:Body>
</soap:Envelope>`;

    try {
      const response = await axios.post(this.baseUrl, soapEnvelope, {
        headers: {
          "Content-Type": "text/xml; charset=utf-8",
          SOAPAction: `http://tempuri.org/Query${database}`,
        },
        timeout: 30000,
      });

      return await this.parseResponse(response.data, database);
    } catch (error: any) {
      throw this.handleError(error);
    }
  }

  /**
   * Parse SOAP XML response to JSON
   */
  private async parseResponse(xmlData: string, database: string): Promise<any> {
    const parser = new xml2js.Parser({
      explicitArray: false,
      mergeAttrs: true,
      normalize: true,
      normalizeTags: false,
    });

    try {
      const result = await parser.parseStringPromise(xmlData);
      
      // Extract response based on database
      const soapBody = result["soap:Envelope"]?.["soap:Body"];
      const response = soapBody?.[`Query${database}Response`]?.[`Query${database}Result`];
      
      if (!response) {
        throw new Error("Invalid SOAP response structure");
      }

      // Parse the result string (typically contains DataSet XML)
      if (typeof response === "string") {
        const dataResult = await parser.parseStringPromise(response);
        const extracted = this.extractTableData(dataResult);
        return extracted;
      }

      const extracted = this.extractTableData(response);
      return extracted;
    } catch (error: any) {
      throw new Error(`Failed to parse SOAP response: ${error.message}`);
    }
  }

  /**
   * Extract table data from DataSet
   */
  private extractTableData(dataSet: any): any[] {
    try {
      // Try multiple possible structures
      let diffgram = dataSet?.DataSet?.["diffgr:diffgram"];
      
      // If DataSet wrapper doesn't exist, try direct diffgram
      if (!diffgram) {
        diffgram = dataSet?.["diffgr:diffgram"];
      }
      
      if (!diffgram) return [];

      const result = diffgram?.Result;
      if (!result) return [];

      const table = result?.Table;
      if (!table) return [];

      // Handle both single record (object) and multiple records (array)
      const records = Array.isArray(table) ? table : [table];
      
      // Clean up records by removing diffgr and msdata attributes
      return records.map((record: any) => {
        const cleaned: any = {};
        for (const key in record) {
          if (!key.startsWith('diffgr:') && !key.startsWith('msdata:')) {
            cleaned[key] = record[key];
          }
        }
        return cleaned;
      });
    } catch (error) {
      return [];
    }
  }

  /**
   * Escape special XML characters
   */
  private escapeXml(str: string): string {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");
  }

  /**
   * Handle SOAP errors
   */
  private handleError(error: any): Error {
    if (error.response) {
      const statusCode = error.response.status;
      const errorData = error.response.data;
      return new Error(`SOAP Error (${statusCode}): ${errorData}`);
    } else if (error.request) {
      return new Error("Network Error: No response from SOAP service");
    } else {
      return new Error(`SOAP Client Error: ${error.message}`);
    }
  }

  /**
   * Test SOAP service connection
   */
  async testConnection(): Promise<boolean> {
    try {
      const result = await this.queryMetermis("SELECT 1 AS TestValue");
      return result !== null;
    } catch (error: any) {
      log(`Connection test failed: ${error.message}`, "soap");
      return false;
    }
  }

  /**
   * Call ProteaResponder Service1.asmx and return the raw string result.
   * Used for methods like CreateLandlordCredit that return a plain string, not a DataSet.
   */
  async callProteaServiceRaw(method: string, params: Record<string, string>): Promise<string> {
    const proteaUrl = "https://www.oami.co.za/ProteaResponder/Service1.asmx";
    const ns = "http://www.proteametering.co.za/";

    const paramsXml = Object.entries(params)
      .map(([key, val]) => `<${key}>${this.escapeXml(val)}</${key}>`)
      .join("");

    const soapEnvelope = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
               xmlns:xsd="http://www.w3.org/2001/XMLSchema"
               xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <${method} xmlns="${ns}">
      ${paramsXml}
    </${method}>
  </soap:Body>
</soap:Envelope>`;

    try {
      const response = await axios.post(proteaUrl, soapEnvelope, {
        headers: {
          "Content-Type": "text/xml; charset=utf-8",
          SOAPAction: `${ns}${method}`,
        },
        timeout: 30000,
      });

      // Extract raw string result from SOAP response
      const parser = new xml2js.Parser({ explicitArray: false, mergeAttrs: true, normalize: true, normalizeTags: false });
      const result = await parser.parseStringPromise(response.data);
      const soapBody = result["soap:Envelope"]?.["soap:Body"];
      const responseNode = soapBody?.[`${method}Response`]?.[`${method}Result`];
      return typeof responseNode === 'string' ? responseNode : String(responseNode ?? '');
    } catch (error: any) {
      throw this.handleError(error);
    }
  }

  /**
   * Call ProteaResponder Service1.asmx for statement data.
   * Different SOAP service: no encryption, different namespace.
   */
  async callProteaService(method: string, params: Record<string, string>): Promise<any[]> {
    const proteaUrl = "https://www.oami.co.za/ProteaResponder/Service1.asmx";
    const ns = "http://www.proteametering.co.za/";

    // Build params XML
    const paramsXml = Object.entries(params)
      .map(([key, val]) => `<${key}>${this.escapeXml(val)}</${key}>`)
      .join("");

    const soapEnvelope = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
               xmlns:xsd="http://www.w3.org/2001/XMLSchema"
               xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <${method} xmlns="${ns}">
      ${paramsXml}
    </${method}>
  </soap:Body>
</soap:Envelope>`;

    try {
      const response = await axios.post(proteaUrl, soapEnvelope, {
        headers: {
          "Content-Type": "text/xml; charset=utf-8",
          SOAPAction: `${ns}${method}`,
        },
        timeout: 30000,
      });

      return await this.parseProteaResponse(response.data, method);
    } catch (error: any) {
      throw this.handleError(error);
    }
  }

  /**
   * Parse ProteaResponder SOAP response — extracts Table1 rows from DataSet
   */
  private async parseProteaResponse(xmlData: string, method: string): Promise<any[]> {
    const parser = new xml2js.Parser({
      explicitArray: false,
      mergeAttrs: true,
      normalize: true,
      normalizeTags: false,
    });

    try {
      const result = await parser.parseStringPromise(xmlData);
      const soapBody = result["soap:Envelope"]?.["soap:Body"];
      const responseNode = soapBody?.[`${method}Response`]?.[`${method}Result`];

      if (!responseNode) {
        throw new Error("Invalid ProteaResponder SOAP response structure");
      }

      // The result is an inline DataSet; parse if string
      let dataSet = responseNode;
      if (typeof responseNode === "string") {
        dataSet = await parser.parseStringPromise(responseNode);
      }

      // Navigate DataSet → diffgr:diffgram → DocumentElement or Result → Table1
      let diffgram = dataSet?.DataSet?.["diffgr:diffgram"]
                  || dataSet?.["diffgr:diffgram"];
      if (!diffgram) return [];

      // ProteaResponder may use "DocumentElement", "Result", or "NewDataSet" as wrapper
      const wrapper = diffgram?.DocumentElement || diffgram?.Result || diffgram?.NewDataSet || diffgram;
      // Table may be named Table1, Table, Balances, or anything — try known names then scan keys
      let table = wrapper?.Table1 || wrapper?.Table || wrapper?.Balances;
      if (!table) {
        // Fallback: find the first key that isn't a diffgr/msdata attribute
        for (const key of Object.keys(wrapper || {})) {
          if (!key.startsWith('diffgr:') && !key.startsWith('msdata:') && typeof wrapper[key] === 'object') {
            table = wrapper[key];
            break;
          }
        }
      }
      if (!table) return [];

      const records = Array.isArray(table) ? table : [table];
      return records.map((rec: any) => {
        const cleaned: any = {};
        for (const key in rec) {
          if (!key.startsWith("diffgr:") && !key.startsWith("msdata:")) {
            cleaned[key] = rec[key];
          }
        }
        return cleaned;
      });
    } catch (error: any) {
      throw new Error(`Failed to parse ProteaResponder response: ${error.message}`);
    }
  }
}

// Export singleton instance
export const soapClient = new SOAPClient();
