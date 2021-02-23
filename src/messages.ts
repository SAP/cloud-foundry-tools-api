export const messages = {
  space_not_set: "Space not set",
  service_creation_started: "Service creation started, waiting for 'Ready' state.",
  create_service_canceled_by_requester: "Cancelled by the requester - The service may have been partially created, consider deleting it using the 'cf delete-service' command",
  failed_creating_entity: (description: string, name: string) => `Could not create the entity since ${description}, consider deleting it using the 'cf delete-service ${name} command'`,
  exceed_number_of_attempts: (name: string) => `Could not change the service-instance to the 'readSync' state. You may monitor its status using the'cf service ${name}' command`,
  service_not_found: (instanceName: string) => `Could not find the '${instanceName}' service instance.`,
  cf_setting_not_set: "Could not find the Cloud Foundry settings. Make sure you have assigned an org and space in Cloud Foundry.",
  no_valid_filters: 'There is no valid filters found.',
  service_creation_failed: (error: string) => `Service creation failed: ${error}`,
  not_allowed_filter: (param: string, query: string) => `Parameter ${param} is not allowed in ${query} query`
};
