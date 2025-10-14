import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'
import { 
  getUserContext, 
  createAuthenticatedClient,
  corsHeaders 
} from '../_shared/auth.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get authenticated user context
    const userContext = await getUserContext(req)
    
    // Create authenticated Supabase client (respects RLS)
    const supabaseClient = createAuthenticatedClient(req)
    
    // Create service role client for admin operations (bypasses RLS)
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
    const { data: membership, error: membershipError } = await supabaseClient
      .from('organization_members')
      .select('role')
      .eq('organization_id', organizationId)
      .eq('user_id', userContext.userId)
      .single()

    if (membershipError || !membership) {
      throw new Error('User does not have access to this organization')
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
        throw membersError
      }

      // Transform the data to flatten the users object
      const transformedMembers = members.map((member: any) => ({
        id: member.id,
        userId: member.user_id,
        name: member.users?.full_name || 'Unknown User',
        email: member.users?.email || '',
        role: member.role,
        joinedAt: member.created_at,
      }))

      return new Response(
        JSON.stringify({ members: transformedMembers }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      )
    }

    // POST - Add new member to organization
    if (method === 'POST') {
      // Only admins and owners can add members
      if (!['admin', 'owner'].includes(userRole)) {
        throw new Error('Insufficient permissions to add members')
      }

      const body = await req.json()
      const { email, role } = body

      if (!email || !role) {
        throw new Error('email and role are required')
      }

      // Validate role (only roles that exist in database)
      const validRoles = ['member', 'admin', 'owner']
      if (!validRoles.includes(role)) {
        throw new Error(`Invalid role. Must be one of: ${validRoles.join(', ')}`)
      }

      // Only owners can add other owners
      if (role === 'owner' && userRole !== 'owner') {
        throw new Error('Only owners can add other owners')
      }

      // Find user by email using admin client (bypasses RLS)
      const { data: targetUser, error: userLookupError } = await supabaseAdmin
        .from('users')
        .select('id')
        .eq('email', email)
        .single()

      if (userLookupError || !targetUser) {
        throw new Error('User not found with that email')
      }

      // Check if user is already a member using admin client
      const { data: existingMember } = await supabaseAdmin
        .from('organization_members')
        .select('id')
        .eq('organization_id', organizationId)
        .eq('user_id', targetUser.id)
        .single()

      if (existingMember) {
        throw new Error('User is already a member of this organization')
      }

      // Add member using admin client (bypasses RLS)
      const { data: newMember, error: addError } = await supabaseAdmin
        .from('organization_members')
        .insert({
          organization_id: organizationId,
          user_id: targetUser.id,
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
        throw addError
      }

      return new Response(
        JSON.stringify({ 
          member: {
            id: newMember.id,
            userId: newMember.user_id,
            name: newMember.users?.full_name || 'Unknown User',
            email: newMember.users?.email || '',
            role: newMember.role,
            joinedAt: newMember.created_at,
          }
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 201,
        }
      )
    }

    // PATCH - Update member role
    if (method === 'PATCH') {
      // Only admins and owners can update members
      if (!['admin', 'owner'].includes(userRole)) {
        throw new Error('Insufficient permissions to update members')
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
        throw new Error('Member not found')
      }

      // Cannot change owner role unless you're an owner
      if (targetMember.role === 'owner' && userRole !== 'owner') {
        throw new Error('Only owners can change owner roles')
      }

      // Cannot set to owner unless you're an owner
      if (role === 'owner' && userRole !== 'owner') {
        throw new Error('Only owners can promote to owner')
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
        throw updateError
      }

      return new Response(
        JSON.stringify({ 
          member: {
            id: updatedMember.id,
            userId: updatedMember.user_id,
            name: updatedMember.users?.full_name || 'Unknown User',
            email: updatedMember.users?.email || '',
            role: updatedMember.role,
            joinedAt: updatedMember.created_at,
          }
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      )
    }

    // DELETE - Remove member from organization
    if (method === 'DELETE') {
      // Only admins and owners can remove members
      if (!['admin', 'owner'].includes(userRole)) {
        throw new Error('Insufficient permissions to remove members')
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
        throw new Error('Member not found')
      }

      // Cannot remove owners unless you're an owner
      if (targetMember.role === 'owner' && userRole !== 'owner') {
        throw new Error('Only owners can remove other owners')
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
        throw deleteError
      }

      return new Response(
        JSON.stringify({ success: true }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      )
    }

    throw new Error('Method not allowed')
  } catch (error) {
    console.error('Error in members function:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})
