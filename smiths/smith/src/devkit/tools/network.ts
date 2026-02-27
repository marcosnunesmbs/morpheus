import axios from 'axios';

export class NetworkTool {
    static async get(url: string, headers?: Record<string, string>): Promise<any> {
        try {
            const response = await axios.get(url, { headers });
            return response.data;
        } catch (error) {
            throw new Error(`GET request failed: ${error.message}`);
        }
    }

    static async post(url: string, data: any, headers?: Record<string, string>): Promise<any> {
        try {
            const response = await axios.post(url, data, { headers });
            return response.data;
        } catch (error) {
            throw new Error(`POST request failed: ${error.message}`);
        }
    }

    static async put(url: string, data: any, headers?: Record<string, string>): Promise<any> {
        try {
            const response = await axios.put(url, data, { headers });
            return response.data;
        } catch (error) {
            throw new Error(`PUT request failed: ${error.message}`);
        }
    }

    static async delete(url: string, headers?: Record<string, string>): Promise<any> {
        try {
            const response = await axios.delete(url, { headers });
            return response.data;
        } catch (error) {
            throw new Error(`DELETE request failed: ${error.message}`);
        }
    }
}