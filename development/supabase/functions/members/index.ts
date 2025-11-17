import { createEdgeFunction, createSuccessResponse, DatabaseError } from '../_shared/request-handler.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'
import { 
  getUserContext 
} from '../_shared/auth.ts'

export default createEdgeFunction(async ({ req }) => {
  // Get authenticated user context
  const userContext = await getUserContext(req)
  
  // Create service role client for all operations (bypasses RLS)
  // Authorization is handled in Edge Function code
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

  const url = new URL(req.url)
  const organizationId = url.searchParams.get('organization_id')
  const method = req.method

  if (!organizationId) {
    throw new Error('organization_id parameter is required')
  }

  // Verify user has access to this organization
  // Use service_role client to bypass RLS (permissions checked in Edge Function logic)
  const { data: membership, error: membershipError } = await supabaseAdmin
    .from('organization_members')
    .select('role')
    .eq('organization_id', organizationId)
    .eq('user_id', userContext.userId)
    .maybeSingle()

  if (membershipError) {
    throw new DatabaseError(`Failed to verify membership: ${membershipError.message}`, 500)
  }

  if (!membership) {
    throw new DatabaseError('User does not have access to this organization', 403)
  }

  const userRole = membership.role

  // GET - List all members in organization
  if (method === 'GET') {
    // Use admin client to get all members (we already verified access above)
    const { data: members, error: membersError } = await supabaseAdmin
      .from('organization_members')
      .select(`
        id,
        user_id,
        role,
        created_at,
        users!organization_members_user_id_fkey (
          id,
          email,
          full_name
        )
      `)
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false })

    if (membersError) {
      throw new DatabaseError(membersError.message)
    }

    // Transform the data to flatten the users object
    // deno-lint-ignore no-explicit-any
    const transformedMembers = members.map((member: any) => ({
      id: member.id,
      userId: member.user_id,
      name: member.users?.full_name || 'Unknown User',
      email: member.users?.email || '',
      role: member.role,
      joinedAt: member.created_at,
    }))

    return createSuccessResponse({ members: transformedMembers })
  }

  // POST - Add new member to organization
  if (method === 'POST') {
    // Only admins and owners can add members
    if (!['admin', 'owner'].includes(userRole)) {
      throw new DatabaseError('Insufficient permissions to add members', 403)
    }

    const body = await req.json()
    const { email, userId, role } = body

    // Accept either email or userId
    if (!email && !userId) {
      throw new Error('Either email or userId is required')
    }

    if (!role) {
      throw new Error('role is required')
    }

    // Validate role (only roles that exist in database)
    const validRoles = ['member', 'admin', 'owner']
    if (!validRoles.includes(role)) {
      throw new Error(`Invalid role. Must be one of: ${validRoles.join(', ')}`)
    }

    // Only owners can add other owners
    if (role === 'owner' && userRole !== 'owner') {
      throw new DatabaseError('Only owners can add other owners', 403)
    }

    let targetUserId: string

    // If userId provided, use it directly; otherwise look up by email
    if (userId) {
      targetUserId = userId
    } else {
      // Find user by email using admin client (bypasses RLS)
      const { data: targetUser, error: userLookupError } = await supabaseAdmin
        .from('users')
        .select('id')
        .eq('email', email)
        .maybeSingle()

      if (userLookupError) {
        throw new DatabaseError(`Failed to find user: ${userLookupError.message}`, 500)
      }

      if (!targetUser) {
        throw new DatabaseError('User not found with that email', 404)
      }

      targetUserId = targetUser.id
    }

    // Check if user is already a member using admin client
    const { data: existingMember, error: existingError } = await supabaseAdmin
      .from('organization_members')
      .select('id')
      .eq('organization_id', organizationId)
      .eq('user_id', targetUserId)
      .maybeSingle()

    if (existingError) {
      throw new DatabaseError(`Failed to check existing membership: ${existingError.message}`, 500)
    }

    if (existingMember) {
      throw new Error('User is already a member of this organization')
    }

    // Add member using admin client (bypasses RLS)
    const { data: newMember, error: addError } = await supabaseAdmin
      .from('organization_members')
      .insert({
        organization_id: organizationId,
        user_id: targetUserId,
        role: role,
      })
      .select(`
        id,
        user_id,
        role,
        created_at,
        users!organization_members_user_id_fkey (
          id,
          email,
          full_name
        )
      `)
      .single()

    if (addError) {
      throw new DatabaseError(addError.message)
    }

    return createSuccessResponse({ 
      member: {
        id: newMember.id,
        userId: newMember.user_id,
        name: newMember.users?.full_name || 'Unknown User',
        email: newMember.users?.email || '',
        role: newMember.role,
        joinedAt: newMember.created_at,
      }
    }, { status: 201 })
  }

  // PATCH - Update member role
  if (method === 'PATCH') {
    // Only admins and owners can update members
    if (!['admin', 'owner'].includes(userRole)) {
      throw new DatabaseError('Insufficient permissions to update members', 403)
    }

    const body = await req.json()
    const { memberId, role } = body

    if (!memberId || !role) {
      throw new Error('memberId and role are required')
    }

    // Validate role (only roles that exist in database)
    const validRoles = ['member', 'admin', 'owner']
    if (!validRoles.includes(role)) {
      throw new Error(`Invalid role. Must be one of: ${validRoles.join(', ')}`)
    }

    // Get the member being updated using admin client
    const { data: targetMember, error: targetError } = await supabaseAdmin
      .from('organization_members')
      .select('role, user_id')
      .eq('id', memberId)
      .eq('organization_id', organizationId)
      .single()

    if (targetError || !targetMember) {
      throw new DatabaseError('Member not found', 404)
    }

    // Cannot change owner role unless you're an owner
    if (targetMember.role === 'owner' && userRole !== 'owner') {
      throw new DatabaseError('Only owners can change owner roles', 403)
    }

    // Cannot set to owner unless you're an owner
    if (role === 'owner' && userRole !== 'owner') {
      throw new DatabaseError('Only owners can promote to owner', 403)
    }

    // Cannot change your own role
    if (targetMember.user_id === userContext.userId) {
      throw new Error('Cannot change your own role')
    }

    // Update the role using admin client (bypasses RLS)
    const { data: updatedMember, error: updateError } = await supabaseAdmin
      .from('organization_members')
      .update({ role })
      .eq('id', memberId)
      .eq('organization_id', organizationId)
      .select(`
        id,
        user_id,
        role,
        created_at,
        users!organization_members_user_id_fkey (
          id,
          email,
          full_name
        )
      `)
      .single()

    if (updateError) {
      throw new DatabaseError(updateError.message)
    }

    return createSuccessResponse({ 
      member: {
        id: updatedMember.id,
        userId: updatedMember.user_id,
        name: updatedMember.users?.full_name || 'Unknown User',
        email: updatedMember.users?.email || '',
        role: updatedMember.role,
        joinedAt: updatedMember.created_at,
      }
    })
  }

  // DELETE - Remove member from organization
  if (method === 'DELETE') {
    // Only admins and owners can remove members
    if (!['admin', 'owner'].includes(userRole)) {
      throw new DatabaseError('Insufficient permissions to remove members', 403)
    }

    const body = await req.json()
    const { memberId } = body

    if (!memberId) {
      throw new Error('memberId is required')
    }

    // Get the member being removed using admin client
    const { data: targetMember, error: targetError } = await supabaseAdmin
      .from('organization_members')
      .select('role, user_id')
      .eq('id', memberId)
      .eq('organization_id', organizationId)
      .single()

    if (targetError || !targetMember) {
      throw new DatabaseError('Member not found', 404)
    }

    // Cannot remove owners unless you're an owner
    if (targetMember.role === 'owner' && userRole !== 'owner') {
      throw new DatabaseError('Only owners can remove other owners', 403)
    }

    // Cannot remove yourself
    if (targetMember.user_id === userContext.userId) {
      throw new Error('Cannot remove yourself from the organization')
    }

    // Remove the member using admin client (bypasses RLS)
    const { error: deleteError } = await supabaseAdmin
      .from('organization_members')
      .delete()
      .eq('id', memberId)
      .eq('organization_id', organizationId)

    if (deleteError) {
      throw new DatabaseError(deleteError.message)
    }

    return createSuccessResponse({ success: true })
  }

  throw new Error('Method not allowed')
}, {
  allowedMethods: ['GET', 'POST', 'PATCH', 'DELETE']
})
