import { apiClient } from "./apiClient";

// The signed-in user's saved addresses (the server scopes every call to them).
export const addressService = {

    async listAddresses() {
        const { data } = await apiClient.get("/addresses");

        return data.data;
    },

    async createAddress(address) {
        const { data } = await apiClient.post("/addresses", address);

        return data.data;
    },

    async updateAddress(id, changes) {
        const { data } = await apiClient.patch(`/addresses/${id}`, changes);

        return data.data;
    },

    async deleteAddress(id) {
        await apiClient.delete(`/addresses/${id}`);
    },

};
