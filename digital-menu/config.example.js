window.GRAVITY58_CONFIG = {
  testMode: false,
  appwrite: {
    endpoint: 'https://server.g58.in/v1',
    projectId: 'YOUR_APPWRITE_PROJECT_ID',
    databaseId: 'gravity58',
    adminTeamId: 'YOUR_G58_TEAM_ID',
    sharedTableId: 'g58_records',
    mediaBucketId: 'ad-media',
    digitalOrderFunctionId: 'create-digital-order',
    collections: {
      posts: 'g58_posts', profiles: 'ad_customer_profiles', bookings: 'ad_bookings',
      advertisements: 'advertisements', slots: 'ad_slots'
    }
  },
  gravity58Url: '../',
  adBookingPortalUrl: '../advertise/',
  currency: 'INR'
};
