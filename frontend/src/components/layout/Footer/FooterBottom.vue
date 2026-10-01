<template>

 <div class="mt-16 border-t border-gray-200 py-8 md:flex md:items-center md:justify-between">
          <div class="text-center md:text-left">
            <p class="text-sm text-gray-500">© {{ new Date().getFullYear() }} Your Company. All rights reserved.</p>
          </div>

          <div class="mt-4 flex items-center justify-center md:mt-0">
            <!-- Prices and orders are USD only; there is no location/currency switch. -->
            <div>
              <span class="text-sm text-gray-500">USD</span>
            </div>
          </div>
        </div>

</template>