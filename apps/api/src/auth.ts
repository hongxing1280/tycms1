import type { AdminPermissionAction, AdminUserPublicRecord } from '@sports/core';
import { cmsRepository } from '@sports/db';
import type { FastifyRequest } from 'fastify';

export type Actor = {
  userId: string;
  username: string;
  displayName: string;
  roleIds: string[];
  roleNames: string[];
  permissions: Array<AdminPermissionAction | string>;
  user: AdminUserPublicRecord;
  ip?: string;
  userAgent?: string;
};

export function getActor(request: FastifyRequest): Actor {
  const token = getBearerToken(request);
  if (!token) {
    throwUnauthorized();
  }

  const actor = cmsRepository.getAdminActorByToken(token);
  if (!actor) {
    throwUnauthorized();
  }

  const userAgentHeader = request.headers['user-agent'];

  return {
    ...actor,
    ip: request.ip,
    userAgent: Array.isArray(userAgentHeader) ? userAgentHeader[0] : userAgentHeader,
  };
}

export function getBearerToken(request: FastifyRequest): string | undefined {
  const header = request.headers.authorization;
  const value = Array.isArray(header) ? header[0] : header;

  if (!value?.startsWith('Bearer ')) {
    return undefined;
  }

  return value.slice('Bearer '.length).trim();
}

export function assertPermission(actor: Actor, permission: AdminPermissionAction): void {
  if (!actor.permissions.includes(permission)) {
    const error = new Error(`Missing permission: ${permission}`);
    error.name = 'ForbiddenError';
    throw error;
  }
}

function throwUnauthorized(): never {
  const error = new Error('Login required');
  error.name = 'UnauthorizedError';
  throw error;
}
