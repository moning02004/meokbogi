export const ZONE_PAGE = {
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
    update: {
        method: "patch",
        endpoint: (args: EndpointArgs) => `/zones/${args.zone}`
    },
    delete: {
        method: "delete",
        endpoint: (args: EndpointArgs) => `/zones/${args.zone}`
    },
} satisfies Record<string, StaticApiEndpointConfig | DynamicApiEndpointConfig>;

export const CATEGORY_API = {
    list: {
        method: "get",
        endpoint: (args: EndpointArgs) => `/zones/${args.zone}/category`
    },
    add: {
        method: "post",
        endpoint: (args: EndpointArgs) => `/zones/${args.zone}/category`
    },
    update: {
        method: "patch",
        endpoint: (args: EndpointArgs) => `/zones/${args.zone}/category/${args.category}`
    },
    delete: {
        method: "delete",
        endpoint: (args: EndpointArgs) => `/zones/${args.zone}/category/${args.category}`
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
    pick: {
        method: "get",
        endpoint: (args: EndpointArgs) => `/zones/${args.zone}/restaurants/pick`
    },
    add: {
        method: "post",
        endpoint: (args: EndpointArgs) => `/zones/${args.zone}/restaurants`
    },
    update: {
        method: "patch",
        endpoint: (args: EndpointArgs) => `/restaurants/${args.restaurant}`
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
    update: {
        method: "patch",
        endpoint: (args: EndpointArgs) => `/restaurants/${args.restaurant}/reviews/${args.review}`
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
    update: {
        method: "patch",
        endpoint: `/users/me`
    },
    changePassword: {
        method: "patch",
        endpoint: `/users/me/password`
    },
    export: {
        method: "get",
        endpoint: `/users/me/export`
    },
    import: {
        method: "post",
        endpoint: `/users/me/import`
    },
} satisfies Record<string, StaticApiEndpointConfig | DynamicApiEndpointConfig>;

export const PUSH_API = {
    config: {method: "get", endpoint: `/push/config`},
    subscribe: {method: "post", endpoint: `/push/subscriptions`},
    unsubscribe: {method: "delete", endpoint: `/push/subscriptions`},
    test: {method: "post", endpoint: `/push/test`},
    send: {method: "post", endpoint: `/push/send`},
} satisfies Record<string, StaticApiEndpointConfig | DynamicApiEndpointConfig>;
