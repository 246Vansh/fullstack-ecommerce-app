<template>
            <div class="flex h-full items-center rounded-lg bg-gray-100 p-6 sm:p-10">
              <div class="w-full max-w-md">
                <h3 class="font-semibold text-gray-900">Sign up for our newsletter</h3>
                <p class="mt-2 text-sm text-gray-500">The latest news, articles, and resources, sent to your inbox weekly.</p>
                <form class="mt-4 sm:mt-6 sm:flex">
                  <input id="email-address" type="email" autocomplete="email" required="" aria-label="Email address" class="block w-full rounded-md bg-white px-4 py-2 text-base text-gray-900 outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-600" />
                  <div class="mt-3 sm:mt-0 sm:ml-4 sm:shrink-0">
                    <button type="submit" @submit.prevent="subscribe" class="flex w-full items-center justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-base font-medium text-white shadow-xs hover:bg-indigo-700 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-white focus:outline-hidden">Sign up</button>
                  </div>
                </form>
              </div>
            </div>
</template>