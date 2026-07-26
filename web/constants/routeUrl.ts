export const ZONE_URL = {
    add: "/zone/add"
}

type ApiMethod = "get" | "post" | "patch" | "delete"

interface StaticApiEndpointConfig {
    method: ApiMethod;
    endpoint: string;
}

interface EndpointArgs {
    zone?: number;
    category?: number;
    restaurant?: number;
    review?: number;
}

interface DynamicApiEndpointConfig {
    method: ApiMethod;
    endpoint: (args: EndpointArgs) => string;
}

export const ZONE_API = {
    list: {method: "get", endpoint: "/zones"},
    add: {method: "post", endpoint: "/zones"},
    dashboard: {
        method: "get",
        endpoint: (args: EndpointArgs) => `/zones/${args.zone}/dashboard`
    },
} satisfies Record<string, StaticApiEndpointConfig | DynamicApiEndpointConfig>;

export const RESTAURANT_PAGE = {
    add: "/restaurant/add",
    detail: (_id: number) => `/restaurant/${_id}`
}

export const RESTAURANT_API = {
    list: {
        method: "get",
        endpoint: (args: EndpointArgs) => `/zones/${args.zone}/restaurants`
    },
    retrieve: {
        method: "get",
        endpoint: (args: EndpointArgs) => `/restaurants/${args.restaurant}`
    },
    add: {
        method: "post",
        endpoint: (args: EndpointArgs) => `/zones/${args.zone}/category/${args.category}/restaurants`
    },
    delete: {
        method: "delete",
        endpoint: (args: EndpointArgs) => `/restaurants/${args.restaurant}`
    },
} satisfies Record<string, StaticApiEndpointConfig | DynamicApiEndpointConfig>;

export const RESTAURANT_REVIEW_API = {
    list: {
        method: "get",
        endpoint: (args: EndpointArgs) => `/restaurants/${args.restaurant}/reviews`
    },
    add: {
        method: "post",
        endpoint: (args: EndpointArgs) => `/restaurants/${args.restaurant}/reviews`
    },
    delete: {
        method: "delete",
        endpoint: (args: EndpointArgs) => `/restaurants/${args.restaurant}/reviews/${args.review}`
    },
} satisfies Record<string, StaticApiEndpointConfig | DynamicApiEndpointConfig>;

export const USER_API = {
    retrieve: {
        method: "get",
        endpoint: `/users/me`
    },
} satisfies Record<string, StaticApiEndpointConfig | DynamicApiEndpointConfig>;
